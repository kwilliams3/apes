-- Migration additive pour SQL Server 2014. Ne supprime aucune donnée.
SET XACT_ABORT ON;
BEGIN TRANSACTION;
IF OBJECT_ID('dbo.apes_audit','U') IS NULL
BEGIN
  CREATE TABLE dbo.apes_audit (
    id INT IDENTITY(1,1) PRIMARY KEY,
    user_id INT NOT NULL,
    action VARCHAR(100) NOT NULL,
    entity VARCHAR(50) NOT NULL,
    entity_id VARCHAR(100) NOT NULL,
    created_at DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME()
  );
END;
IF COL_LENGTH('dbo.users','Matricule') IS NULL
  ALTER TABLE dbo.users ADD Matricule VARCHAR(50) NOT NULL DEFAULT '';
IF COL_LENGTH('dbo.users','region') IS NULL
  ALTER TABLE dbo.users ADD region VARCHAR(100) NOT NULL DEFAULT '';
IF COL_LENGTH('dbo.users','auth_version') IS NULL
  ALTER TABLE dbo.users ADD auth_version INT NOT NULL DEFAULT 0;
-- Les mots de passe scrypt nécessitent 168 caractères.
IF EXISTS (SELECT 1 FROM sys.columns WHERE object_id=OBJECT_ID('dbo.users') AND name='password' AND max_length < 255 AND max_length > 0)
  ALTER TABLE dbo.users ALTER COLUMN password VARCHAR(255) NOT NULL;
IF NOT EXISTS (SELECT 1 FROM dbo.roles WHERE name='membre') INSERT dbo.roles(name) VALUES ('membre');
IF NOT EXISTS (SELECT 1 FROM dbo.roles WHERE name='commissaire') INSERT dbo.roles(name) VALUES ('commissaire');
IF NOT EXISTS (SELECT 1 FROM dbo.roles WHERE name='chef_personnel') INSERT dbo.roles(name) VALUES ('chef_personnel');
IF NOT EXISTS (SELECT 1 FROM dbo.roles WHERE name='president') INSERT dbo.roles(name) VALUES ('president');
IF NOT EXISTS (SELECT 1 FROM dbo.debug) INSERT dbo.debug(debug01) VALUES (CONVERT(VARCHAR(19),GETDATE(),120));
IF OBJECT_ID('dbo.apes_audit_notes','U') IS NULL
  CREATE TABLE dbo.apes_audit_notes (
    id INT IDENTITY(1,1) PRIMARY KEY,
    user_id INT NOT NULL,
    loan_id INT NOT NULL,
    note NVARCHAR(300) NOT NULL,
    created_at DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME()
  );
COMMIT TRANSACTION;
