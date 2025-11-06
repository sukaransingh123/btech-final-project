export const PARTICIPANTS = {
  MANUFACTURER: "0x6c45A0eA03E5719a4A8d5fb2c2A7eD4D59eA2267",
  DISTRIBUTOR: "0x9236b51387c167a3D2fE14BdA6bc7517FD0C74C5",
  RETAILER: "0x1d22d371e231E6ccA714CF3a4163a655D5914C02"
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
