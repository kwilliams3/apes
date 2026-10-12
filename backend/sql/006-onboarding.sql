SET XACT_ABORT ON;
IF COL_LENGTH('dbo.users','must_change_password') IS NULL
 ALTER TABLE dbo.users ADD must_change_password BIT NOT NULL CONSTRAINT DF_users_must_change_password DEFAULT 0;
