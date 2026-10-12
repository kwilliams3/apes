SET XACT_ABORT ON;
IF OBJECT_ID('dbo.apes_permissions','U') IS NULL
 CREATE TABLE dbo.apes_permissions (
 id INT IDENTITY(1,1) PRIMARY KEY,
 subject_type VARCHAR(10) NOT NULL CHECK (subject_type IN ('role','user')),
 subject_id INT NOT NULL,
 rules NVARCHAR(MAX) NOT NULL,
 updated_by INT NOT NULL REFERENCES dbo.users(UID),
 updated_at DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
 CONSTRAINT UX_apes_permissions_subject UNIQUE(subject_type,subject_id)
 );
