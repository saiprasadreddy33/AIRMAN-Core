const email = 'studenta@test.com';
const password = 'password';

fetch('http://localhost:3001/auth/login', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email, password })
})
.then(r => r.json())
.then(data => {
  console.log('Token:', data.accessToken);
  fetch('http://localhost:3001/bookings', {
    headers: { 'Authorization': `Bearer ${data.accessToken}` }
  })
  .then(r => r.json())
  .then(console.log);
});
