-- Suivi des modifications de cotisations et contrôle de concurrence.
SET XACT_ABORT ON;
BEGIN TRANSACTION;
IF COL_LENGTH('dbo.cotisation','edit_version') IS NULL
 ALTER TABLE dbo.cotisation ADD edit_version INT NOT NULL DEFAULT 0;
IF OBJECT_ID('dbo.apes_contribution_changes','U') IS NULL
BEGIN
 CREATE TABLE dbo.apes_contribution_changes (
  id INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
  contribution_id INT NOT NULL,
  action VARCHAR(20) NOT NULL,
  month_number INT NULL,
  month_before DECIMAL(18,2) NULL,
  month_after DECIMAL(18,2) NULL,
  reduction_before DECIMAL(18,2) NOT NULL,
  reduction_after DECIMAL(18,2) NOT NULL,
  balance_before DECIMAL(18,2) NOT NULL,
  balance_after DECIMAL(18,2) NOT NULL,
  reason NVARCHAR(300) NOT NULL,
  recorded_by INT NOT NULL,
  recorded_at DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
  FOREIGN KEY(contribution_id) REFERENCES dbo.cotisation(id),
  FOREIGN KEY(recorded_by) REFERENCES dbo.users(UID)
 );
 CREATE INDEX IX_contribution_changes_record ON dbo.apes_contribution_changes(contribution_id,id);
END;
COMMIT TRANSACTION;
