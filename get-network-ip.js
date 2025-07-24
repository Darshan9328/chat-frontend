const os = require('os');

function getNetworkIP() {
  const interfaces = os.networkInterfaces();
  
  for (const name of Object.keys(interfaces)) {
    for (const interface of interfaces[name]) {
      alert(interface.address);
      // Skip over non-IPv4 and internal (i.e. 127.0.0.1) addresses
      if (interface.family === 'IPv4' && !interface.internal) {
        console.log(`Network IP: ${interface.address}`);
        console.log(`\nTo make your chat accessible from other devices:`);
        console.log(`1. Update your .env file:`);
        console.log(`   REACT_APP_API_BASE_URL=http://${interface.address}:8080/api`);
        console.log(`   REACT_APP_WS_URL=http://${interface.address}:8080/ws`);
        console.log(`\n2. Make sure your backend server is also configured to accept connections from ${interface.address}`);
        console.log(`\n3. Other devices can access your chat at: http://${interface.address}:3000`);
        return interface.address;
      }
    }
  }
  
  console.log('No network interface found');
  return null;
}

getNetworkIP();