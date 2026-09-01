export const PARTICIPANTS = {
  MANUFACTURER: "0x093F8CA5f70Dd1dbC39Df1A30F2F0D8Ab05B8510",
  DISTRIBUTOR: "0x6D9149Ca7E04FDAE6c2b880d4C22d1e834e436b5",
  RETAILER: "0xA514337cbcc4149952220A23487eF961E748Ce8C",
  PHARMACY: "0x02d61482CAB7847e8E46D68C58e2601a8c2D589c"
};

// Demo participant information with Indian names and locations
export const PARTICIPANT_INFO = {
  [PARTICIPANTS.MANUFACTURER.toLowerCase()]: {
    name: "Sun Pharma Industries Ltd.",
    contactPerson: "Rajesh Kumar",
    location: {
      city: "Mumbai",
      state: "Maharashtra",
      address: "Plot No. 201, Andheri Industrial Area, Mumbai - 400093",
      pinCode: "400093"
    },
    role: "Manufacturer"
  },
  [PARTICIPANTS.DISTRIBUTOR.toLowerCase()]: {
    name: "MediLink Distribution Pvt. Ltd.",
    contactPerson: "Priya Sharma",
    location: {
      city: "Delhi",
      state: "Delhi",
      address: "Sector 18, Noida, Delhi - 201301",
      pinCode: "201301"
    },
    role: "Distributor"
  },
  [PARTICIPANTS.RETAILER.toLowerCase()]: {
    name: "Apollo Pharmacy",
    contactPerson: "Amit Patel",
    location: {
      city: "Bangalore",
      state: "Karnataka",
      address: "MG Road, Bangalore - 560001",
      pinCode: "560001"
    },
    role: "Retailer"
  },
  [PARTICIPANTS.PHARMACY.toLowerCase()]: {
    name: "Local Care Pharmacy",
    contactPerson: "Vikram Singh",
    location: {
      city: "Pune",
      state: "Maharashtra",
      address: "Main Street, Pune - 411001",
      pinCode: "411001"
    },
    role: "Pharmacy"
  }
};

// Helper function to get participant info
export const getParticipantInfo = (address) => {
  if (!address) return null;
  return PARTICIPANT_INFO[address.toLowerCase()] || null;
};

// Helper function to get participant name
export const getParticipantName = (address) => {
  const info = getParticipantInfo(address);
  return info ? info.name : address?.slice(0, 6) + '...' + address?.slice(-4);
};

// Helper function to get participant location
export const getParticipantLocation = (address) => {
  const info = getParticipantInfo(address);
  if (!info || !info.location) return 'Unknown Location';
  return `${info.location.city}, ${info.location.state} - ${info.location.pinCode}`;
};
