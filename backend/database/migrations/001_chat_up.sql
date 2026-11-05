/* Freely encrypted chat migration 001: MANUAL EXECUTION ONLY.
   Target: SQL Server 2019+ / Azure SQL, current database containing dbo.users.
   Existing 47 tables and all seed rows are unchanged. Adds five tables only.
   Review docs/chat-database.md, back up the database, then run this script in
   SSMS or sqlcmd against the intended database. Do not run schema.sql on it.
   Safe rerun requires an exact compatible existing chat shape; partial or
   conflicting objects stop the transaction. No startup code executes this file.
*/
SET NOCOUNT ON;
SET XACT_ABORT ON;
SET ANSI_NULLS ON;
SET QUOTED_IDENTIFIER ON;
SET ANSI_PADDING ON;
SET ANSI_WARNINGS ON;
SET ARITHABORT ON;
SET CONCAT_NULL_YIELDS_NULL ON;
SET NUMERIC_ROUNDABORT OFF;

BEGIN TRY
    BEGIN TRANSACTION;
    DECLARE @lock_result int;
    EXEC @lock_result = sys.sp_getapplock
        @Resource = N'freely.chat.migration.001', @LockMode = N'Exclusive',
        @LockOwner = N'Transaction', @LockTimeout = 10000;
    IF @lock_result < 0
        THROW 51000, 'Could not acquire the chat migration lock.', 1;
    IF EXISTS (SELECT 1 FROM sys.databases
               WHERE database_id = DB_ID() AND compatibility_level < 110)
        THROW 51012, 'Chat migration requires database compatibility level 110 or newer.', 1;
    IF OBJECT_ID(N'dbo.users', N'U') IS NULL OR NOT EXISTS (
        SELECT 1 FROM sys.columns c
        WHERE c.object_id = OBJECT_ID(N'dbo.users') AND c.name = N'id'
          AND TYPE_NAME(c.user_type_id) = N'bigint' AND c.is_nullable = 0
    )
        THROW 51001, 'Prerequisite dbo.users.id BIGINT NOT NULL is missing.', 1;
    IF NOT EXISTS (
        SELECT 1 FROM sys.indexes i
        JOIN sys.index_columns ic ON ic.object_id = i.object_id AND ic.index_id = i.index_id
        JOIN sys.columns c ON c.object_id = ic.object_id AND c.column_id = ic.column_id
        WHERE i.object_id = OBJECT_ID(N'dbo.users') AND i.is_unique = 1
          AND i.is_disabled = 0 AND i.has_filter = 0 AND ic.key_ordinal = 1 AND c.name = N'id'
          AND NOT EXISTS (SELECT 1 FROM sys.index_columns other
                          WHERE other.object_id = i.object_id AND other.index_id = i.index_id
                            AND other.key_ordinal > 1)
    )
        THROW 51002, 'Prerequisite dbo.users.id unique key is missing.', 1;

    DECLARE @expected_tables table (table_name sysname PRIMARY KEY);
    INSERT INTO @expected_tables VALUES
        (N'chat_conversations'), (N'chat_devices'), (N'chat_prekeys'),
        (N'chat_messages'), (N'chat_message_envelopes');
    IF EXISTS (SELECT 1 FROM @expected_tables e
               JOIN sys.objects o ON o.name = e.table_name AND o.schema_id = SCHEMA_ID(N'dbo')
               WHERE o.type <> N'U')
        THROW 51003, 'A conflicting non-table object occupies a chat table name.', 1;
    DECLARE @existing_count int = (
        SELECT COUNT(*) FROM @expected_tables e
        WHERE OBJECT_ID(N'dbo.' + e.table_name, N'U') IS NOT NULL);
    IF @existing_count NOT IN (0, 5)
        THROW 51004, 'Partial chat schema found. Review it before applying migration 001.', 1;

    IF @existing_count = 0
    BEGIN
        CREATE TABLE dbo.chat_conversations (
            id BIGINT NOT NULL IDENTITY(1,1),
            public_conversation_id NVARCHAR(40) NOT NULL,
            participant_low_user_id BIGINT NOT NULL,
            participant_high_user_id BIGINT NOT NULL,
            created_at DATETIME2 NOT NULL CONSTRAINT DF_chat_conversations_created DEFAULT (SYSUTCDATETIME()),
            updated_at DATETIME2 NULL,
            CONSTRAINT [PK_chat_conversations] PRIMARY KEY (id),
            CONSTRAINT [UQ_chat_conversations_public_id] UNIQUE (public_conversation_id),
            CONSTRAINT [UQ_chat_conversations_pair] UNIQUE (participant_low_user_id, participant_high_user_id),
            CONSTRAINT [FK_chat_conversations_low_user] FOREIGN KEY(participant_low_user_id) REFERENCES dbo.users (id),
            CONSTRAINT [FK_chat_conversations_high_user] FOREIGN KEY(participant_high_user_id) REFERENCES dbo.users (id),
            CONSTRAINT [CK_chat_conversations_distinct_pair] CHECK (participant_low_user_id < participant_high_user_id),
            CONSTRAINT [CK_chat_conversations_updated] CHECK (updated_at IS NULL OR updated_at >= created_at)
        );

        CREATE INDEX [IX_chat_conversations_high_updated] ON dbo.chat_conversations (participant_high_user_id, updated_at, id);

        CREATE INDEX [IX_chat_conversations_low_updated] ON dbo.chat_conversations (participant_low_user_id, updated_at, id);

        CREATE TABLE dbo.chat_devices (
            id BIGINT NOT NULL IDENTITY(1,1),
            public_device_id NVARCHAR(40) NOT NULL,
            user_id BIGINT NOT NULL,
            signal_device_id INTEGER NOT NULL,
            registration_id INTEGER NOT NULL,
            protocol_version NVARCHAR(32) NOT NULL,
            identity_public_key VARBINARY(33) NOT NULL,
            label NVARCHAR(100) NULL,
            created_at DATETIME2 NOT NULL CONSTRAINT DF_chat_devices_created DEFAULT (SYSUTCDATETIME()),
            last_seen_at DATETIME2 NULL,
            revoked_at DATETIME2 NULL,
            CONSTRAINT [PK_chat_devices] PRIMARY KEY (id),
            CONSTRAINT [UQ_chat_devices_public_id] UNIQUE (public_device_id),
            CONSTRAINT [UQ_chat_devices_user_signal_id] UNIQUE (user_id, signal_device_id),
            CONSTRAINT [UQ_chat_devices_owner_id] UNIQUE (user_id, id),
            CONSTRAINT [FK_chat_devices_user] FOREIGN KEY(user_id) REFERENCES dbo.users (id),
            CONSTRAINT [CK_chat_devices_signal_id] CHECK (signal_device_id BETWEEN 1 AND 127),
            CONSTRAINT [CK_chat_devices_registration_id] CHECK (registration_id BETWEEN 1 AND 16383),
            CONSTRAINT [CK_chat_devices_protocol] CHECK (protocol_version = 'signal-pqxdh-v1'),
            CONSTRAINT [CK_chat_devices_identity_key] CHECK (DATALENGTH(identity_public_key) = 33),
            CONSTRAINT [CK_chat_devices_last_seen] CHECK (last_seen_at IS NULL OR last_seen_at >= created_at),
            CONSTRAINT [CK_chat_devices_revoked] CHECK (revoked_at IS NULL OR revoked_at >= created_at)
        );

        CREATE INDEX [IX_chat_devices_active_user] ON dbo.chat_devices (user_id, signal_device_id) WHERE revoked_at IS NULL;

        CREATE TABLE dbo.chat_prekeys (
            device_id BIGINT NOT NULL,
            key_kind NVARCHAR(32) NOT NULL,
            key_id INTEGER NOT NULL,
            protocol_version NVARCHAR(32) NOT NULL,
            public_key VARBINARY(1569) NOT NULL,
            signature VARBINARY(64) NULL,
            created_at DATETIME2 NOT NULL CONSTRAINT DF_chat_prekeys_created DEFAULT (SYSUTCDATETIME()),
            expires_at DATETIME2 NULL,
            retired_at DATETIME2 NULL,
            claimed_at DATETIME2 NULL,
            CONSTRAINT [PK_chat_prekeys] PRIMARY KEY (device_id, key_kind, key_id),
            CONSTRAINT [FK_chat_prekeys_device] FOREIGN KEY(device_id) REFERENCES dbo.chat_devices (id),
            CONSTRAINT [CK_chat_prekeys_kind] CHECK (key_kind IN ('ec_signed','ec_one_time','kem_one_time','kem_last_resort')),
            CONSTRAINT [CK_chat_prekeys_key_id] CHECK (key_id BETWEEN 0 AND 16777215),
            CONSTRAINT [CK_chat_prekeys_protocol] CHECK (protocol_version = 'signal-pqxdh-v1'),
            CONSTRAINT [CK_chat_prekeys_public_material] CHECK ((key_kind = 'ec_one_time' AND DATALENGTH(public_key) = 33 AND signature IS NULL) OR (key_kind = 'ec_signed' AND DATALENGTH(public_key) = 33 AND signature IS NOT NULL AND DATALENGTH(signature) = 64) OR (key_kind IN ('kem_one_time','kem_last_resort') AND DATALENGTH(public_key) = 1569 AND signature IS NOT NULL AND DATALENGTH(signature) = 64)),
            CONSTRAINT [CK_chat_prekeys_expiry] CHECK (expires_at IS NULL OR expires_at > created_at),
            CONSTRAINT [CK_chat_prekeys_retired] CHECK (retired_at IS NULL OR retired_at >= created_at),
            CONSTRAINT [CK_chat_prekeys_claimed] CHECK (claimed_at IS NULL OR (key_kind IN ('ec_one_time','kem_one_time') AND claimed_at >= created_at))
        );

        CREATE INDEX [IX_chat_prekeys_available] ON dbo.chat_prekeys (device_id, key_kind, key_id) WHERE claimed_at IS NULL AND retired_at IS NULL;

        CREATE TABLE dbo.chat_messages (
            id BIGINT NOT NULL IDENTITY(1,1),
            public_message_id NVARCHAR(40) NOT NULL,
            conversation_id BIGINT NOT NULL,
            sender_user_id BIGINT NOT NULL,
            sender_device_id BIGINT NOT NULL,
            client_message_id UNIQUEIDENTIFIER NOT NULL,
            request_digest VARBINARY(32) NOT NULL,
            created_at DATETIME2 NOT NULL CONSTRAINT DF_chat_messages_created DEFAULT (SYSUTCDATETIME()),
            CONSTRAINT [PK_chat_messages] PRIMARY KEY (id),
            CONSTRAINT [UQ_chat_messages_public_id] UNIQUE (public_message_id),
            CONSTRAINT [UQ_chat_messages_client_id] UNIQUE (sender_device_id, client_message_id),
            CONSTRAINT [FK_chat_messages_conversation] FOREIGN KEY(conversation_id) REFERENCES dbo.chat_conversations (id),
            CONSTRAINT [FK_chat_messages_sender_device] FOREIGN KEY(sender_user_id, sender_device_id) REFERENCES dbo.chat_devices (user_id, id),
            CONSTRAINT [CK_chat_messages_digest] CHECK (DATALENGTH(request_digest) = 32)
        );

        CREATE INDEX [IX_chat_messages_conversation_id] ON dbo.chat_messages (conversation_id, id);

        CREATE TABLE dbo.chat_message_envelopes (
            id BIGINT NOT NULL IDENTITY(1,1),
            message_id BIGINT NOT NULL,
            recipient_user_id BIGINT NOT NULL,
            recipient_device_id BIGINT NOT NULL,
            protocol_version NVARCHAR(32) NOT NULL,
            message_type INTEGER NOT NULL,
            ciphertext VARBINARY(max) NOT NULL,
            created_at DATETIME2 NOT NULL CONSTRAINT DF_chat_message_envelopes_created DEFAULT (SYSUTCDATETIME()),
            delivered_at DATETIME2 NULL,
            read_at DATETIME2 NULL,
            CONSTRAINT [PK_chat_message_envelopes] PRIMARY KEY (id),
            CONSTRAINT [UQ_chat_envelopes_message_device] UNIQUE (message_id, recipient_device_id),
            CONSTRAINT [FK_chat_envelopes_message] FOREIGN KEY(message_id) REFERENCES dbo.chat_messages (id),
            CONSTRAINT [FK_chat_envelopes_recipient_device] FOREIGN KEY(recipient_user_id, recipient_device_id) REFERENCES dbo.chat_devices (user_id, id),
            CONSTRAINT [CK_chat_envelopes_protocol] CHECK (protocol_version = 'signal-pqxdh-v1'),
            CONSTRAINT [CK_chat_envelopes_message_type] CHECK (message_type IN (2,3)),
            CONSTRAINT [CK_chat_envelopes_ciphertext] CHECK (DATALENGTH(ciphertext) BETWEEN 1 AND 65536),
            CONSTRAINT [CK_chat_envelopes_delivered] CHECK (delivered_at IS NULL OR delivered_at >= created_at),
            CONSTRAINT [CK_chat_envelopes_read] CHECK (read_at IS NULL OR (delivered_at IS NOT NULL AND read_at >= delivered_at))
        );

        CREATE INDEX [IX_chat_envelopes_device_history] ON dbo.chat_message_envelopes (recipient_device_id, message_id);

        CREATE INDEX [IX_chat_envelopes_pending] ON dbo.chat_message_envelopes (recipient_device_id, id) WHERE delivered_at IS NULL;
    END;

    -- Exact column types, lengths, nullability, identity, precision and scale.
    DECLARE @expected_columns table (
        table_name sysname, column_name sysname, type_name sysname,
        max_length smallint, [precision] tinyint, scale tinyint,
        is_nullable bit, is_identity bit,
        PRIMARY KEY (table_name, column_name));
    INSERT INTO @expected_columns VALUES
        (N'chat_conversations', N'id', N'bigint', 8, 19, 0, 0, 1),
        (N'chat_conversations', N'public_conversation_id', N'nvarchar', 80, 0, 0, 0, 0),
        (N'chat_conversations', N'participant_low_user_id', N'bigint', 8, 19, 0, 0, 0),
        (N'chat_conversations', N'participant_high_user_id', N'bigint', 8, 19, 0, 0, 0),
        (N'chat_conversations', N'created_at', N'datetime2', 8, 27, 7, 0, 0),
        (N'chat_conversations', N'updated_at', N'datetime2', 8, 27, 7, 1, 0),
        (N'chat_devices', N'id', N'bigint', 8, 19, 0, 0, 1),
        (N'chat_devices', N'public_device_id', N'nvarchar', 80, 0, 0, 0, 0),
        (N'chat_devices', N'user_id', N'bigint', 8, 19, 0, 0, 0),
        (N'chat_devices', N'signal_device_id', N'int', 4, 10, 0, 0, 0),
        (N'chat_devices', N'registration_id', N'int', 4, 10, 0, 0, 0),
        (N'chat_devices', N'protocol_version', N'nvarchar', 64, 0, 0, 0, 0),
        (N'chat_devices', N'identity_public_key', N'varbinary', 33, 0, 0, 0, 0),
        (N'chat_devices', N'label', N'nvarchar', 200, 0, 0, 1, 0),
        (N'chat_devices', N'created_at', N'datetime2', 8, 27, 7, 0, 0),
        (N'chat_devices', N'last_seen_at', N'datetime2', 8, 27, 7, 1, 0),
        (N'chat_devices', N'revoked_at', N'datetime2', 8, 27, 7, 1, 0),
        (N'chat_prekeys', N'device_id', N'bigint', 8, 19, 0, 0, 0),
        (N'chat_prekeys', N'key_kind', N'nvarchar', 64, 0, 0, 0, 0),
        (N'chat_prekeys', N'key_id', N'int', 4, 10, 0, 0, 0),
        (N'chat_prekeys', N'protocol_version', N'nvarchar', 64, 0, 0, 0, 0),
        (N'chat_prekeys', N'public_key', N'varbinary', 1569, 0, 0, 0, 0),
        (N'chat_prekeys', N'signature', N'varbinary', 64, 0, 0, 1, 0),
        (N'chat_prekeys', N'created_at', N'datetime2', 8, 27, 7, 0, 0),
        (N'chat_prekeys', N'expires_at', N'datetime2', 8, 27, 7, 1, 0),
        (N'chat_prekeys', N'retired_at', N'datetime2', 8, 27, 7, 1, 0),
        (N'chat_prekeys', N'claimed_at', N'datetime2', 8, 27, 7, 1, 0),
        (N'chat_messages', N'id', N'bigint', 8, 19, 0, 0, 1),
        (N'chat_messages', N'public_message_id', N'nvarchar', 80, 0, 0, 0, 0),
        (N'chat_messages', N'conversation_id', N'bigint', 8, 19, 0, 0, 0),
        (N'chat_messages', N'sender_user_id', N'bigint', 8, 19, 0, 0, 0),
        (N'chat_messages', N'sender_device_id', N'bigint', 8, 19, 0, 0, 0),
        (N'chat_messages', N'client_message_id', N'uniqueidentifier', 16, 0, 0, 0, 0),
        (N'chat_messages', N'request_digest', N'varbinary', 32, 0, 0, 0, 0),
        (N'chat_messages', N'created_at', N'datetime2', 8, 27, 7, 0, 0),
        (N'chat_message_envelopes', N'id', N'bigint', 8, 19, 0, 0, 1),
        (N'chat_message_envelopes', N'message_id', N'bigint', 8, 19, 0, 0, 0),
        (N'chat_message_envelopes', N'recipient_user_id', N'bigint', 8, 19, 0, 0, 0),
        (N'chat_message_envelopes', N'recipient_device_id', N'bigint', 8, 19, 0, 0, 0),
        (N'chat_message_envelopes', N'protocol_version', N'nvarchar', 64, 0, 0, 0, 0),
        (N'chat_message_envelopes', N'message_type', N'int', 4, 10, 0, 0, 0),
        (N'chat_message_envelopes', N'ciphertext', N'varbinary', -1, 0, 0, 0, 0),
        (N'chat_message_envelopes', N'created_at', N'datetime2', 8, 27, 7, 0, 0),
        (N'chat_message_envelopes', N'delivered_at', N'datetime2', 8, 27, 7, 1, 0),
        (N'chat_message_envelopes', N'read_at', N'datetime2', 8, 27, 7, 1, 0);
    DECLARE @actual_columns table (
        table_name sysname, column_name sysname, type_name sysname,
        max_length smallint, [precision] tinyint, scale tinyint,
        is_nullable bit, is_identity bit);
    INSERT INTO @actual_columns
    SELECT t.name, c.name, TYPE_NAME(c.user_type_id), c.max_length,
           c.precision, c.scale, c.is_nullable, c.is_identity
    FROM sys.tables t JOIN sys.columns c ON c.object_id = t.object_id
    JOIN @expected_tables e ON e.table_name = t.name
    WHERE t.schema_id = SCHEMA_ID(N'dbo') AND c.is_computed = 0;
    IF EXISTS (SELECT * FROM @expected_columns EXCEPT SELECT * FROM @actual_columns)
       OR EXISTS (SELECT * FROM @actual_columns EXCEPT SELECT * FROM @expected_columns)
       OR EXISTS (SELECT 1 FROM sys.columns c JOIN sys.tables t ON t.object_id = c.object_id
                  JOIN @expected_tables e ON e.table_name = t.name
                  WHERE t.schema_id = SCHEMA_ID(N'dbo') AND c.is_computed = 1)
        THROW 51005, 'Chat column definitions differ from migration 001.', 1;
    IF EXISTS (SELECT 1 FROM sys.identity_columns c JOIN sys.tables t ON t.object_id = c.object_id
               JOIN @expected_tables e ON e.table_name = t.name
               WHERE t.schema_id = SCHEMA_ID(N'dbo')
                 AND (CONVERT(bigint, c.seed_value) <> 1 OR CONVERT(bigint, c.increment_value) <> 1))
        THROW 51006, 'Chat identity seed/increment differs from migration 001.', 1;

    -- Validate keys, defaults, CHECK expressions and exact FK column pairing.
    DECLARE @expected_constraints table (
        table_name sysname, constraint_name sysname, kind nvarchar(2), definition nvarchar(max) COLLATE Latin1_General_100_BIN2);
    INSERT INTO @expected_constraints VALUES
        (N'chat_conversations', N'DF_chat_conversations_created', N'D', N'created_at=sysutcdatetime'),
        (N'chat_conversations', N'FK_chat_conversations_high_user', N'F', N'participant_high_user_id>users(id)'),
        (N'chat_conversations', N'FK_chat_conversations_low_user', N'F', N'participant_low_user_id>users(id)'),
        (N'chat_conversations', N'PK_chat_conversations', N'PK', N'id'),
        (N'chat_conversations', N'UQ_chat_conversations_pair', N'UQ', N'participant_low_user_id,participant_high_user_id'),
        (N'chat_conversations', N'UQ_chat_conversations_public_id', N'UQ', N'public_conversation_id'),
        (N'chat_devices', N'DF_chat_devices_created', N'D', N'created_at=sysutcdatetime'),
        (N'chat_devices', N'FK_chat_devices_user', N'F', N'user_id>users(id)'),
        (N'chat_devices', N'PK_chat_devices', N'PK', N'id'),
        (N'chat_devices', N'UQ_chat_devices_owner_id', N'UQ', N'user_id,id'),
        (N'chat_devices', N'UQ_chat_devices_public_id', N'UQ', N'public_device_id'),
        (N'chat_devices', N'UQ_chat_devices_user_signal_id', N'UQ', N'user_id,signal_device_id'),
        (N'chat_message_envelopes', N'DF_chat_message_envelopes_created', N'D', N'created_at=sysutcdatetime'),
        (N'chat_message_envelopes', N'FK_chat_envelopes_message', N'F', N'message_id>chat_messages(id)'),
        (N'chat_message_envelopes', N'FK_chat_envelopes_recipient_device', N'F', N'recipient_user_id,recipient_device_id>chat_devices(user_id,id)'),
        (N'chat_message_envelopes', N'PK_chat_message_envelopes', N'PK', N'id'),
        (N'chat_message_envelopes', N'UQ_chat_envelopes_message_device', N'UQ', N'message_id,recipient_device_id'),
        (N'chat_messages', N'DF_chat_messages_created', N'D', N'created_at=sysutcdatetime'),
        (N'chat_messages', N'FK_chat_messages_conversation', N'F', N'conversation_id>chat_conversations(id)'),
        (N'chat_messages', N'FK_chat_messages_sender_device', N'F', N'sender_user_id,sender_device_id>chat_devices(user_id,id)'),
        (N'chat_messages', N'PK_chat_messages', N'PK', N'id'),
        (N'chat_messages', N'UQ_chat_messages_client_id', N'UQ', N'sender_device_id,client_message_id'),
        (N'chat_messages', N'UQ_chat_messages_public_id', N'UQ', N'public_message_id'),
        (N'chat_prekeys', N'DF_chat_prekeys_created', N'D', N'created_at=sysutcdatetime'),
        (N'chat_prekeys', N'FK_chat_prekeys_device', N'F', N'device_id>chat_devices(id)'),
        (N'chat_prekeys', N'PK_chat_prekeys', N'PK', N'device_id,key_kind,key_id');

    -- SQL Server may rewrite IN/BETWEEN to OR/range expressions in the catalog.
    -- Parse the approved predicates on this same server using a session-local
    -- reference with identical column types, nullability and database collation.
    -- Compare engine-generated definitions, preserving case and grouping.
    -- No reference table, constraint or application row survives this block.
    CREATE TABLE #chat_check_reference (
        [id] BIGINT NOT NULL,
        [public_conversation_id] NVARCHAR(40) COLLATE DATABASE_DEFAULT NOT NULL,
        [participant_low_user_id] BIGINT NOT NULL,
        [participant_high_user_id] BIGINT NOT NULL,
        [created_at] DATETIME2 NOT NULL,
        [updated_at] DATETIME2 NULL,
        [public_device_id] NVARCHAR(40) COLLATE DATABASE_DEFAULT NOT NULL,
        [user_id] BIGINT NOT NULL,
        [signal_device_id] INTEGER NOT NULL,
        [registration_id] INTEGER NOT NULL,
        [protocol_version] NVARCHAR(32) COLLATE DATABASE_DEFAULT NOT NULL,
        [identity_public_key] VARBINARY(33) NOT NULL,
        [label] NVARCHAR(100) COLLATE DATABASE_DEFAULT NULL,
        [last_seen_at] DATETIME2 NULL,
        [revoked_at] DATETIME2 NULL,
        [device_id] BIGINT NOT NULL,
        [key_kind] NVARCHAR(32) COLLATE DATABASE_DEFAULT NOT NULL,
        [key_id] INTEGER NOT NULL,
        [public_key] VARBINARY(1569) NOT NULL,
        [signature] VARBINARY(64) NULL,
        [expires_at] DATETIME2 NULL,
        [retired_at] DATETIME2 NULL,
        [claimed_at] DATETIME2 NULL,
        [public_message_id] NVARCHAR(40) COLLATE DATABASE_DEFAULT NOT NULL,
        [conversation_id] BIGINT NOT NULL,
        [sender_user_id] BIGINT NOT NULL,
        [sender_device_id] BIGINT NOT NULL,
        [client_message_id] UNIQUEIDENTIFIER NOT NULL,
        [request_digest] VARBINARY(32) NOT NULL,
        [message_id] BIGINT NOT NULL,
        [recipient_user_id] BIGINT NOT NULL,
        [recipient_device_id] BIGINT NOT NULL,
        [message_type] INTEGER NOT NULL,
        [ciphertext] VARBINARY(max) NOT NULL,
        [delivered_at] DATETIME2 NULL,
        [read_at] DATETIME2 NULL
    );
    DECLARE @check_sources table (
        table_name sysname, constraint_name sysname, source_expression nvarchar(max));
    INSERT INTO @check_sources VALUES
        (N'chat_conversations', N'CK_chat_conversations_distinct_pair', N'participant_low_user_id < participant_high_user_id'),
        (N'chat_conversations', N'CK_chat_conversations_updated', N'updated_at IS NULL OR updated_at >= created_at'),
        (N'chat_devices', N'CK_chat_devices_identity_key', N'DATALENGTH(identity_public_key) = 33'),
        (N'chat_devices', N'CK_chat_devices_last_seen', N'last_seen_at IS NULL OR last_seen_at >= created_at'),
        (N'chat_devices', N'CK_chat_devices_protocol', N'protocol_version = ''signal-pqxdh-v1'''),
        (N'chat_devices', N'CK_chat_devices_registration_id', N'registration_id BETWEEN 1 AND 16383'),
        (N'chat_devices', N'CK_chat_devices_revoked', N'revoked_at IS NULL OR revoked_at >= created_at'),
        (N'chat_devices', N'CK_chat_devices_signal_id', N'signal_device_id BETWEEN 1 AND 127'),
        (N'chat_prekeys', N'CK_chat_prekeys_claimed', N'claimed_at IS NULL OR (key_kind IN (''ec_one_time'',''kem_one_time'') AND claimed_at >= created_at)'),
        (N'chat_prekeys', N'CK_chat_prekeys_expiry', N'expires_at IS NULL OR expires_at > created_at'),
        (N'chat_prekeys', N'CK_chat_prekeys_key_id', N'key_id BETWEEN 0 AND 16777215'),
        (N'chat_prekeys', N'CK_chat_prekeys_kind', N'key_kind IN (''ec_signed'',''ec_one_time'',''kem_one_time'',''kem_last_resort'')'),
        (N'chat_prekeys', N'CK_chat_prekeys_protocol', N'protocol_version = ''signal-pqxdh-v1'''),
        (N'chat_prekeys', N'CK_chat_prekeys_public_material', N'(key_kind = ''ec_one_time'' AND DATALENGTH(public_key) = 33 AND signature IS NULL) OR (key_kind = ''ec_signed'' AND DATALENGTH(public_key) = 33 AND signature IS NOT NULL AND DATALENGTH(signature) = 64) OR (key_kind IN (''kem_one_time'',''kem_last_resort'') AND DATALENGTH(public_key) = 1569 AND signature IS NOT NULL AND DATALENGTH(signature) = 64)'),
        (N'chat_prekeys', N'CK_chat_prekeys_retired', N'retired_at IS NULL OR retired_at >= created_at'),
        (N'chat_messages', N'CK_chat_messages_digest', N'DATALENGTH(request_digest) = 32'),
        (N'chat_message_envelopes', N'CK_chat_envelopes_ciphertext', N'DATALENGTH(ciphertext) BETWEEN 1 AND 65536'),
        (N'chat_message_envelopes', N'CK_chat_envelopes_delivered', N'delivered_at IS NULL OR delivered_at >= created_at'),
        (N'chat_message_envelopes', N'CK_chat_envelopes_message_type', N'message_type IN (2,3)'),
        (N'chat_message_envelopes', N'CK_chat_envelopes_protocol', N'protocol_version = ''signal-pqxdh-v1'''),
        (N'chat_message_envelopes', N'CK_chat_envelopes_read', N'read_at IS NULL OR (delivered_at IS NOT NULL AND read_at >= delivered_at)');
    DECLARE @check_table sysname, @check_name sysname, @check_source nvarchar(max),
            @reference_name sysname, @reference_sql nvarchar(max);
    DECLARE chat_check_sources CURSOR LOCAL FAST_FORWARD FOR
        SELECT table_name, constraint_name, source_expression FROM @check_sources;
    OPEN chat_check_sources;
    FETCH NEXT FROM chat_check_sources INTO @check_table, @check_name, @check_source;
    WHILE @@FETCH_STATUS = 0
    BEGIN
        -- @check_source comes only from the literal approved list above.
        SET @reference_sql = N'ALTER TABLE #chat_check_reference ADD CHECK (' + @check_source + N');';
        EXEC sys.sp_executesql @reference_sql;
        IF (SELECT COUNT(*) FROM tempdb.sys.check_constraints
            WHERE parent_object_id = OBJECT_ID(N'tempdb..#chat_check_reference')) <> 1
            THROW 51011, 'Could not derive an expected CHECK definition.', 1;
        INSERT INTO @expected_constraints (table_name, constraint_name, kind, definition)
        SELECT @check_table, @check_name, N'C', REPLACE(REPLACE(REPLACE(REPLACE(definition, N' ', N''), CHAR(9), N''), CHAR(10), N''), CHAR(13), N'')
        FROM tempdb.sys.check_constraints
        WHERE parent_object_id = OBJECT_ID(N'tempdb..#chat_check_reference');
        SELECT @reference_name = name FROM tempdb.sys.check_constraints
        WHERE parent_object_id = OBJECT_ID(N'tempdb..#chat_check_reference');
        SET @reference_sql = N'ALTER TABLE #chat_check_reference DROP CONSTRAINT ' + QUOTENAME(@reference_name) + N';';
        EXEC sys.sp_executesql @reference_sql;
        FETCH NEXT FROM chat_check_sources INTO @check_table, @check_name, @check_source;
    END;
    CLOSE chat_check_sources;
    DEALLOCATE chat_check_sources;
    DROP TABLE #chat_check_reference;

    DECLARE @actual_constraints table (
        table_name sysname, constraint_name sysname, kind nvarchar(2), definition nvarchar(max) COLLATE Latin1_General_100_BIN2);
    INSERT INTO @actual_constraints
    SELECT t.name, k.name, k.type,
           (SELECT STRING_AGG(CONVERT(nvarchar(max), c.name), N',') WITHIN GROUP (ORDER BY ic.key_ordinal)
            FROM sys.index_columns ic JOIN sys.columns c
              ON c.object_id = ic.object_id AND c.column_id = ic.column_id
            WHERE ic.object_id = k.parent_object_id AND ic.index_id = k.unique_index_id AND ic.key_ordinal > 0)
    FROM sys.key_constraints k JOIN sys.tables t ON t.object_id = k.parent_object_id
    JOIN @expected_tables e ON e.table_name = t.name WHERE t.schema_id = SCHEMA_ID(N'dbo');
    INSERT INTO @actual_constraints
    SELECT t.name, c.name, N'C', REPLACE(REPLACE(REPLACE(REPLACE(c.definition, N' ', N''), CHAR(9), N''), CHAR(10), N''), CHAR(13), N'')
    FROM sys.check_constraints c JOIN sys.tables t ON t.object_id = c.parent_object_id
    JOIN @expected_tables e ON e.table_name = t.name WHERE t.schema_id = SCHEMA_ID(N'dbo');
    INSERT INTO @actual_constraints
    SELECT t.name, d.name, N'D', c.name + N'=' + LOWER(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(d.definition, N'(', N''), N')', N''), N'[', N''), N']', N''), N' ', N''), CHAR(9), N''), CHAR(10), N''), CHAR(13), N''))
    FROM sys.default_constraints d JOIN sys.tables t ON t.object_id = d.parent_object_id
    JOIN sys.columns c ON c.object_id = d.parent_object_id AND c.column_id = d.parent_column_id
    JOIN @expected_tables e ON e.table_name = t.name WHERE t.schema_id = SCHEMA_ID(N'dbo');
    INSERT INTO @actual_constraints
    SELECT t.name, f.name, N'F',
        (SELECT STRING_AGG(CONVERT(nvarchar(max), c.name), N',') WITHIN GROUP (ORDER BY fc.constraint_column_id)
         FROM sys.foreign_key_columns fc JOIN sys.columns c
           ON c.object_id = fc.parent_object_id AND c.column_id = fc.parent_column_id
         WHERE fc.constraint_object_id = f.object_id)
        + N'>' + rt.name + N'(' +
        (SELECT STRING_AGG(CONVERT(nvarchar(max), c.name), N',') WITHIN GROUP (ORDER BY fc.constraint_column_id)
         FROM sys.foreign_key_columns fc JOIN sys.columns c
           ON c.object_id = fc.referenced_object_id AND c.column_id = fc.referenced_column_id
         WHERE fc.constraint_object_id = f.object_id) + N')'
    FROM sys.foreign_keys f JOIN sys.tables t ON t.object_id = f.parent_object_id
    JOIN sys.tables rt ON rt.object_id = f.referenced_object_id
    JOIN @expected_tables e ON e.table_name = t.name
    WHERE t.schema_id = SCHEMA_ID(N'dbo') AND rt.schema_id = SCHEMA_ID(N'dbo');
    IF EXISTS (SELECT * FROM @expected_constraints EXCEPT SELECT * FROM @actual_constraints)
       OR EXISTS (SELECT * FROM @actual_constraints EXCEPT SELECT * FROM @expected_constraints)
        THROW 51007, 'Chat constraints differ from migration 001.', 1;
    IF EXISTS (SELECT 1 FROM sys.check_constraints c JOIN sys.tables t ON t.object_id = c.parent_object_id
               JOIN @expected_tables e ON e.table_name = t.name WHERE t.schema_id = SCHEMA_ID(N'dbo')
                 AND (c.is_disabled = 1 OR c.is_not_trusted = 1))
       OR EXISTS (SELECT 1 FROM sys.foreign_keys f JOIN sys.tables t ON t.object_id = f.parent_object_id
                  JOIN @expected_tables e ON e.table_name = t.name WHERE t.schema_id = SCHEMA_ID(N'dbo')
                    AND (f.is_disabled = 1 OR f.is_not_trusted = 1 OR f.delete_referential_action <> 0 OR f.update_referential_action <> 0))
        THROW 51008, 'Chat constraints are disabled, untrusted, or cascading.', 1;

    -- Include PK/UQ backing indexes; reject changed or disabled index shapes.
    DECLARE @expected_indexes table (
        table_name sysname, index_name sysname, is_unique bit, index_type tinyint,
        is_primary_key bit, is_unique_constraint bit, filter_definition nvarchar(max),
        key_columns nvarchar(max), included_columns nvarchar(max));
    INSERT INTO @expected_indexes VALUES
        (N'chat_conversations', N'IX_chat_conversations_high_updated', 0, 2, 0, 0, N'', N'participant_high_user_id,updated_at,id', N''),
        (N'chat_conversations', N'IX_chat_conversations_low_updated', 0, 2, 0, 0, N'', N'participant_low_user_id,updated_at,id', N''),
        (N'chat_conversations', N'PK_chat_conversations', 1, 1, 1, 0, N'', N'id', N''),
        (N'chat_conversations', N'UQ_chat_conversations_pair', 1, 2, 0, 1, N'', N'participant_low_user_id,participant_high_user_id', N''),
        (N'chat_conversations', N'UQ_chat_conversations_public_id', 1, 2, 0, 1, N'', N'public_conversation_id', N''),
        (N'chat_devices', N'IX_chat_devices_active_user', 0, 2, 0, 0, N'revoked_atisnull', N'user_id,signal_device_id', N''),
        (N'chat_devices', N'PK_chat_devices', 1, 1, 1, 0, N'', N'id', N''),
        (N'chat_devices', N'UQ_chat_devices_owner_id', 1, 2, 0, 1, N'', N'user_id,id', N''),
        (N'chat_devices', N'UQ_chat_devices_public_id', 1, 2, 0, 1, N'', N'public_device_id', N''),
        (N'chat_devices', N'UQ_chat_devices_user_signal_id', 1, 2, 0, 1, N'', N'user_id,signal_device_id', N''),
        (N'chat_message_envelopes', N'IX_chat_envelopes_device_history', 0, 2, 0, 0, N'', N'recipient_device_id,message_id', N''),
        (N'chat_message_envelopes', N'IX_chat_envelopes_pending', 0, 2, 0, 0, N'delivered_atisnull', N'recipient_device_id,id', N''),
        (N'chat_message_envelopes', N'PK_chat_message_envelopes', 1, 1, 1, 0, N'', N'id', N''),
        (N'chat_message_envelopes', N'UQ_chat_envelopes_message_device', 1, 2, 0, 1, N'', N'message_id,recipient_device_id', N''),
        (N'chat_messages', N'IX_chat_messages_conversation_id', 0, 2, 0, 0, N'', N'conversation_id,id', N''),
        (N'chat_messages', N'PK_chat_messages', 1, 1, 1, 0, N'', N'id', N''),
        (N'chat_messages', N'UQ_chat_messages_client_id', 1, 2, 0, 1, N'', N'sender_device_id,client_message_id', N''),
        (N'chat_messages', N'UQ_chat_messages_public_id', 1, 2, 0, 1, N'', N'public_message_id', N''),
        (N'chat_prekeys', N'IX_chat_prekeys_available', 0, 2, 0, 0, N'claimed_atisnullandretired_atisnull', N'device_id,key_kind,key_id', N''),
        (N'chat_prekeys', N'PK_chat_prekeys', 1, 1, 1, 0, N'', N'device_id,key_kind,key_id', N'');
    DECLARE @actual_indexes table (
        table_name sysname, index_name sysname, is_unique bit, index_type tinyint,
        is_primary_key bit, is_unique_constraint bit, filter_definition nvarchar(max),
        key_columns nvarchar(max), included_columns nvarchar(max));
    INSERT INTO @actual_indexes
    SELECT t.name, i.name, i.is_unique, i.type, i.is_primary_key, i.is_unique_constraint,
        LOWER(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(COALESCE(i.filter_definition, N''), N'(', N''), N')', N''), N'[', N''), N']', N''), N' ', N''), CHAR(9), N''), CHAR(10), N''), CHAR(13), N'')),
        COALESCE((SELECT STRING_AGG(CONVERT(nvarchar(max), c.name + CASE WHEN ic.is_descending_key = 1 THEN N' DESC' ELSE N'' END), N',')
                  WITHIN GROUP (ORDER BY ic.key_ordinal)
                  FROM sys.index_columns ic JOIN sys.columns c ON c.object_id = ic.object_id AND c.column_id = ic.column_id
                  WHERE ic.object_id = i.object_id AND ic.index_id = i.index_id AND ic.key_ordinal > 0), N''),
        COALESCE((SELECT STRING_AGG(CONVERT(nvarchar(max), c.name), N',') WITHIN GROUP (ORDER BY ic.index_column_id)
                  FROM sys.index_columns ic JOIN sys.columns c ON c.object_id = ic.object_id AND c.column_id = ic.column_id
                  WHERE ic.object_id = i.object_id AND ic.index_id = i.index_id AND ic.is_included_column = 1), N'')
    FROM sys.indexes i JOIN sys.tables t ON t.object_id = i.object_id
    JOIN @expected_tables e ON e.table_name = t.name
    WHERE t.schema_id = SCHEMA_ID(N'dbo') AND i.index_id > 0 AND i.is_hypothetical = 0;
    IF EXISTS (SELECT * FROM @expected_indexes EXCEPT SELECT * FROM @actual_indexes)
       OR EXISTS (SELECT * FROM @actual_indexes EXCEPT SELECT * FROM @expected_indexes)
       OR EXISTS (SELECT 1 FROM sys.indexes i JOIN sys.tables t ON t.object_id = i.object_id
                  JOIN @expected_tables e ON e.table_name = t.name
                  WHERE t.schema_id = SCHEMA_ID(N'dbo') AND i.is_disabled = 1)
        THROW 51009, 'Chat index definitions differ from migration 001.', 1;
    IF EXISTS (SELECT 1 FROM sys.triggers tr JOIN sys.tables t ON t.object_id = tr.parent_id
               JOIN @expected_tables e ON e.table_name = t.name WHERE t.schema_id = SCHEMA_ID(N'dbo'))
        THROW 51010, 'Unexpected chat table trigger found. Review before proceeding.', 1;

    COMMIT TRANSACTION;
    PRINT 'Chat migration 001 verified: five additive tables. Enable chat only after application crypto checks pass.';
END TRY
BEGIN CATCH
    IF XACT_STATE() <> 0 ROLLBACK TRANSACTION;
    THROW;
END CATCH;
