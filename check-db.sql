-- Check counts in all tables
SELECT 
  'Employee' as table_name, COUNT(*) as count FROM "Employee"
UNION ALL
SELECT 'Request', COUNT(*) FROM "Request"
UNION ALL
SELECT 'Notification', COUNT(*) FROM "Notification"
UNION ALL
SELECT 'SlaEvent', COUNT(*) FROM "SlaEvent"
UNION ALL
SELECT 'SlaConfig', COUNT(*) FROM "SlaConfig"
UNION ALL
SELECT 'Skill', COUNT(*) FROM "Skill"
ORDER BY table_name;
