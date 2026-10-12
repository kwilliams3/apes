-- Historique des remboursements. SQL Server 2014, migration additive.
SET XACT_ABORT ON;
BEGIN TRANSACTION;
IF OBJECT_ID('dbo.apes_repayments','U') IS NULL
BEGIN
 CREATE TABLE dbo.apes_repayments (
  id INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
  request_key VARCHAR(36) NOT NULL UNIQUE,
  echeance_id INT NOT NULL,
  loan_code VARCHAR(100) NOT NULL,
  amount DECIMAL(18,2) NOT NULL CHECK(amount>0),
  recorded_by INT NOT NULL,
  recorded_at DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
  reversed_by INT NULL,
  reversed_at DATETIME2 NULL,
  reversal_reason NVARCHAR(300) NULL,
  FOREIGN KEY(echeance_id) REFERENCES dbo.echeances(IDECH),
  FOREIGN KEY(recorded_by) REFERENCES dbo.users(UID)
 );
 CREATE INDEX IX_apes_repayments_echeance ON dbo.apes_repayments(echeance_id);
 CREATE INDEX IX_apes_repayments_loan ON dbo.apes_repayments(loan_code);
END;
COMMIT TRANSACTION;
