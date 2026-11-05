"""Offline MSSQL schema/ORM contract checks. Never opens a database connection."""

from pathlib import Path
import re
import unittest

from sqlalchemy import CheckConstraint, ForeignKeyConstraint
from sqlalchemy.dialects import mssql
from sqlalchemy.schema import CreateIndex, CreateTable

from app.models.chat import (
    ChatConversation, ChatDevice, ChatPreKey, ChatMessage, ChatMessageEnvelope,
)

ROOT = Path(__file__).resolve().parents[2]
TABLES = tuple(model.__table__ for model in (
    ChatConversation, ChatDevice, ChatPreKey, ChatMessage, ChatMessageEnvelope,
))


def normalize_ddl(value: str) -> str:
    value = re.sub(r"\bdbo\.", "", value, flags=re.I)
    value = re.sub(r"\bCONSTRAINT\s+DF_chat_\w+\s+", "", value, flags=re.I)
    value = re.sub(r"\bIDENTITY\(1,1\)", "IDENTITY", value, flags=re.I)
    value = re.sub(r"DEFAULT\s+\(SYSUTCDATETIME\(\)\)", "DEFAULT SYSUTCDATETIME()", value, flags=re.I)
    return re.sub(r"[\s\[\];]", "", value).lower()


class ChatSchemaContractTests(unittest.TestCase):
    def test_full_schema_and_manual_migration_match_mssql_models(self):
        sources = (
            ROOT / "backend/database/schema.sql",
            ROOT / "backend/database/migrations/001_chat_up.sql",
        )
        for source in sources:
            value = source.read_text(encoding="utf-8")
            for table in TABLES:
                with self.subTest(source=source.name, table=table.name):
                    found = re.search(
                        rf"CREATE TABLE dbo\.{table.name}\s*\(.*?^\s*\);",
                        value, flags=re.S | re.M,
                    )
                    self.assertIsNotNone(found)
                    expected = str(CreateTable(table).compile(dialect=mssql.dialect()))
                    self.assertEqual(normalize_ddl(expected), normalize_ddl(found.group()))
                    for index in table.indexes:
                        emitted = str(CreateIndex(index).compile(dialect=mssql.dialect()))
                        self.assertIn(normalize_ddl(emitted), normalize_ddl(value))

    def test_ciphertext_bounds_signatures_and_receipt_semantics_are_checked(self):
        checks = {
            constraint.name: str(constraint.sqltext)
            for table in TABLES for constraint in table.constraints
            if isinstance(constraint, CheckConstraint)
        }
        self.assertIn("BETWEEN 1 AND 65536", checks["CK_chat_envelopes_ciphertext"])
        self.assertIn("delivered_at IS NOT NULL", checks["CK_chat_envelopes_read"])
        material = checks["CK_chat_prekeys_public_material"]
        self.assertIn("signature IS NOT NULL AND DATALENGTH(signature) = 64", material)
        self.assertIn("DATALENGTH(public_key) = 1569", material)
        self.assertNotIn("kem_last_resort", checks["CK_chat_prekeys_claimed"])
        forbidden = {"plaintext", "body", "private_key", "session_state", "decrypted_content"}
        for table in TABLES:
            self.assertTrue(forbidden.isdisjoint(table.c.keys()))

    def test_device_owner_foreign_keys_pair_exact_columns(self):
        for model, owner_field, device_field in (
            (ChatMessage, "sender_user_id", "sender_device_id"),
            (ChatMessageEnvelope, "recipient_user_id", "recipient_device_id"),
        ):
            matches = [fk for fk in model.__table__.constraints
                       if isinstance(fk, ForeignKeyConstraint)
                       and list(fk.column_keys) == [owner_field, device_field]]
            self.assertEqual(len(matches), 1)
            self.assertEqual([item.target_fullname for item in matches[0].elements],
                             ["chat_devices.user_id", "chat_devices.id"])

    def test_manual_scripts_have_atomic_guards_and_no_original_table_alterations(self):
        up = (ROOT / "backend/database/migrations/001_chat_up.sql").read_text(encoding="utf-8")
        down = (ROOT / "backend/database/migrations/001_chat_down.sql").read_text(encoding="utf-8")
        self.assertIn("SET XACT_ABORT ON", up)
        self.assertIn("@expected_columns", up)
        self.assertIn("@expected_constraints", up)
        self.assertIn("@expected_indexes", up)
        self.assertIn("is_not_trusted", up)
        self.assertNotRegex(up, r"(?i)(ALTER|DROP)\s+TABLE\s+dbo\.")
        self.assertIn("Rollback refused: chat data exists", down)
        self.assertLess(down.index("Rollback refused"), down.index("DROP TABLE"))
        dropped = re.findall(r"DROP TABLE dbo\.(\w+)", down)
        self.assertEqual(dropped, ["chat_message_envelopes", "chat_messages", "chat_prekeys", "chat_devices", "chat_conversations"])

    def test_check_catalog_expectations_are_parsed_by_the_target_server(self):
        up = (ROOT / "backend/database/migrations/001_chat_up.sql").read_text(encoding="utf-8")
        self.assertIn("CREATE TABLE #chat_check_reference", up)
        self.assertIn("COLLATE DATABASE_DEFAULT", up)
        self.assertIn("FROM tempdb.sys.check_constraints", up)
        self.assertIn("EXEC sys.sp_executesql @reference_sql", up)
        self.assertIn("DROP TABLE #chat_check_reference", up)
        self.assertIn("definition nvarchar(max) COLLATE Latin1_General_100_BIN2", up)
        sources = up.split("INSERT INTO @check_sources VALUES", 1)[1].split("DECLARE @check_table", 1)[0]
        for table in TABLES:
            for constraint in table.constraints:
                if isinstance(constraint, CheckConstraint):
                    literal = str(constraint.sqltext).replace("'", "''")
                    self.assertIn(f"N'{constraint.name}', N'{literal}'", sources)
        # Handwritten expressions are input to SQL Server, not an assumed
        # canonical form. IN/BETWEEN may appear differently in its catalog.
        initial = up.split("INSERT INTO @expected_constraints VALUES", 1)[1].split("CREATE TABLE #chat_check_reference", 1)[0]
        self.assertNotRegex(initial, r", N'C',")
        actual = up.split("SELECT t.name, c.name, N'C',", 1)[1].split("FROM sys.check_constraints c", 1)[0]
        self.assertNotIn("LOWER", actual)
        self.assertNotIn("N'('", actual)
        self.assertNotIn("N')'", actual)


if __name__ == "__main__":
    unittest.main()
