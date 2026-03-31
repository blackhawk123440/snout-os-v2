// Quick test to verify password hash
const bcrypt = require('bcryptjs');

const password = 'Saint214!';
const hash = '$2b$10$shlVzw6CFY87F2WZV/ieruwuNuuyG9UpQbmc8YBKHEQGnytI9GkCq';

console.log('Testing password hash...');
console.log('Password:', password);
console.log('Hash:', hash);

bcrypt.compare(password, hash).then(isValid => {
  console.log('✅ Hash is valid:', isValid);
  if (!isValid) {
    console.log('❌ Hash does not match password!');
    console.log('Generating new hash...');
    bcrypt.hash(password, 10).then(newHash => {
      console.log('New hash:', newHash);
    });
  }
}).catch(err => {
  console.error('Error:', err);
});
