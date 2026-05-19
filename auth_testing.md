See integration_playbook_expert_v2 response for full Emergent Auth Testing Playbook.

## Quick test
```
mongosh --eval "
use('test_database');
var uid = 'test-user-' + Date.now();
var token = 'test_session_' + Date.now();
db.users.insertOne({user_id: uid, email: 'tester@applymate.au', name: 'Test', picture: 'https://i.pravatar.cc/150', created_at: new Date().toISOString()});
db.user_sessions.insertOne({user_id: uid, session_token: token, expires_at: new Date(Date.now()+7*24*60*60*1000).toISOString()});
db.preferences.insertOne({user_id: uid, target_roles: [], locations: ['Australia'], salary_min: 0, remote_ok: true, graduate_only: false});
print('TOKEN=' + token);
"
```

Then use cookie `session_token=<token>` or header `Authorization: Bearer <token>`.
Tests cleanup: `db.users.deleteMany({email:/applymate/}); db.user_sessions.deleteMany({session_token:/^test_session_/});`
