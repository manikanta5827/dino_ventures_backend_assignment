
-- database trigger to ensure the audit_ledger table is read only

CREATE OR REPLACE FUNCTION prevent_ledger_modification()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'Ledger entries cannot be modified or deleted';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER prevent_ledger_update
BEFORE UPDATE ON audit_ledger
FOR EACH ROW EXECUTE FUNCTION prevent_ledger_modification();

CREATE TRIGGER prevent_ledger_delete
BEFORE DELETE ON audit_ledger
FOR EACH ROW EXECUTE FUNCTION prevent_ledger_modification();