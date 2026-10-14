SET XACT_ABORT ON;
IF OBJECT_ID('dbo.apes_contribution_pauses','U') IS NULL
BEGIN
 CREATE TABLE dbo.apes_contribution_pauses (
 id INT IDENTITY(1,1) PRIMARY KEY,
 Matricule VARCHAR(50) NOT NULL,
 start_period INT NOT NULL,
 end_period INT NULL,
 reason NVARCHAR(300) NOT NULL,
 resume_reason NVARCHAR(300) NULL,
 paused_by INT NOT NULL REFERENCES dbo.users(UID),
 paused_at DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
 resumed_by INT NULL REFERENCES dbo.users(UID),
 resumed_at DATETIME2 NULL,
 CHECK(end_period IS NULL OR end_period>=start_period)
 );
 CREATE UNIQUE INDEX UX_contribution_pause_open ON dbo.apes_contribution_pauses(Matricule) WHERE end_period IS NULL;
 CREATE INDEX IX_contribution_pause_period ON dbo.apes_contribution_pauses(Matricule,start_period,end_period);
END;
