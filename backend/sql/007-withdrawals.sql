SET XACT_ABORT ON;
IF COL_LENGTH('dbo.cotisation','Retraits') IS NULL
 ALTER TABLE dbo.cotisation ADD Retraits DECIMAL(18,2) NOT NULL DEFAULT 0;
IF OBJECT_ID('dbo.apes_withdrawals','U') IS NULL
BEGIN
 CREATE TABLE dbo.apes_withdrawals (
 id INT IDENTITY(1,1) PRIMARY KEY,
 contribution_id INT NOT NULL REFERENCES dbo.cotisation(id),
 amount DECIMAL(18,2) NOT NULL CHECK(amount>0),
 reason NVARCHAR(300) NOT NULL,
 status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','approved','paid','rejected')),
 requested_by INT NOT NULL REFERENCES dbo.users(UID),
 requested_at DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
 personnel_by INT NULL REFERENCES dbo.users(UID), personnel_at DATETIME2 NULL,
 admin_by INT NULL REFERENCES dbo.users(UID), admin_at DATETIME2 NULL,
 paid_by INT NULL REFERENCES dbo.users(UID), paid_at DATETIME2 NULL,
 rejected_by INT NULL REFERENCES dbo.users(UID), rejected_at DATETIME2 NULL,
 rejection_reason NVARCHAR(300) NULL
 );
 CREATE INDEX IX_withdrawals_contribution ON dbo.apes_withdrawals(contribution_id,status);
END;
