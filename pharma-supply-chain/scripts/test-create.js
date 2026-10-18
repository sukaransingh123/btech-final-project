const fetch = require('node-fetch');

async function test() {
  try {
    const batchData = {
      batchID: 'test-api-1',
      drugName: 'Paracetamol',
      manufacturingDate: '2026-09-01',
      expiryDate: '2027-09-01',
      quantity: '100',
      manufacturer: '0x093F8CA5f70Dd1dbC39Df1A30F2F0D8Ab05B8510',
      contractAddress: '0x2C56C3107EE29eaE4A486C6c1244bCbb3E2Ee11c'
    };

    const formData = new URLSearchParams();
    for (const key in batchData) {
      formData.append(key, batchData[key]);
    }

    // Since we can't easily do FormData with file via node-fetch without extra libs, 
    // let's just send JSON if the backend accepts it? 
    // Wait, backend expects multipart/form-data because of `upload.single('qaCertificate')`!
    // multer will NOT parse JSON!
    
  } catch(e) {
    console.error(e);
  }
}
test();
