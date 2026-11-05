/* Freely chat migration 001 rollback: MANUAL EXECUTION ONLY.
   Disable chat and stop its workers before running. This refuses to discard ANY
   chat data, even public devices/prekeys. After usage, disable the feature and
   retain the tables; destructive data removal needs a separate explicit decision.
   The original 47 tables and seed data are never changed.
*/
SET NOCOUNT ON;
SET XACT_ABORT ON;
BEGIN TRY
    BEGIN TRANSACTION;
    DECLARE @lock_result int;
    EXEC @lock_result = sys.sp_getapplock
        @Resource = N'freely.chat.migration.001', @LockMode = N'Exclusive',
        @LockOwner = N'Transaction', @LockTimeout = 10000;
    IF @lock_result < 0 THROW 51100, 'Could not acquire chat rollback lock.', 1;
    DECLARE @count int = (
        SELECT COUNT(*) FROM sys.tables WHERE schema_id = SCHEMA_ID(N'dbo')
        AND name IN (N'chat_conversations',N'chat_devices',N'chat_prekeys',N'chat_messages',N'chat_message_envelopes'));
    IF @count NOT IN (0,5) THROW 51101, 'Partial chat schema: inspect manually before rollback.', 1;
    IF @count = 5
    BEGIN
        -- Dynamic SQL defers name resolution, permitting a safe no-op rerun
        -- after all five tables have already been removed.
        EXEC sys.sp_executesql N'
            IF EXISTS (SELECT 1 FROM dbo.chat_message_envelopes WITH (TABLOCKX, HOLDLOCK))
               OR EXISTS (SELECT 1 FROM dbo.chat_messages WITH (TABLOCKX, HOLDLOCK))
               OR EXISTS (SELECT 1 FROM dbo.chat_prekeys WITH (TABLOCKX, HOLDLOCK))
               OR EXISTS (SELECT 1 FROM dbo.chat_devices WITH (TABLOCKX, HOLDLOCK))
               OR EXISTS (SELECT 1 FROM dbo.chat_conversations WITH (TABLOCKX, HOLDLOCK))
                THROW 51102, ''Rollback refused: chat data exists. Disable chat and retain its encrypted tables.'', 1;
            DROP TABLE dbo.chat_message_envelopes;
            DROP TABLE dbo.chat_messages;
            DROP TABLE dbo.chat_prekeys;
            DROP TABLE dbo.chat_devices;
            DROP TABLE dbo.chat_conversations;';
    END;
    COMMIT TRANSACTION;
    PRINT 'Chat rollback complete; original database objects unchanged.';
END TRY
BEGIN CATCH
    IF XACT_STATE() <> 0 ROLLBACK TRANSACTION;
    THROW;
END CATCH;
