import React, { useState } from 'react';
import { ethers } from 'ethers';
import lifecycleArtifact from '../contracts/PharmaSupplyChain.json';
import apiService from '../utils/api';

const roleName = ['Unregistered', 'Supplier', 'Manufacturer', 'Distributor', 'Pharmacy', 'Consumer'];
const address = process.env.REACT_APP_SUPPLY_CHAIN_CONTRACT_ADDRESS;

export default function LifecyclePortal() {
  const [account, setAccount] = useState(''); const [role, setRole] = useState(0);
  const [batchId, setBatchId] = useState(''); const [drugName, setDrugName] = useState(''); const [recipient, setRecipient] = useState(''); const [message, setMessage] = useState('');
  const getContract = async () => {
    if (!window.ethereum) throw new Error('Install MetaMask to use the stakeholder portal.');
    if (!ethers.isAddress(address || '')) throw new Error('Set REACT_APP_SUPPLY_CHAIN_CONTRACT_ADDRESS in frontend/.env.');
    const provider = new ethers.BrowserProvider(window.ethereum); const signer = await provider.getSigner();
    return { signer, contract: new ethers.Contract(address, lifecycleArtifact.abi, signer) };
  };
  const connect = async () => { try { const { signer, contract } = await getContract(); const a = await signer.getAddress(); setAccount(a); setRole(Number(await contract.getRole(a))); } catch (e) { setMessage(e.message); } };
  const submit = async (kind) => {
    try {
      const { signer, contract } = await getContract(); const sender = await signer.getAddress(); let tx;
      if (kind === 'create') { tx = await contract.addRawMaterial(drugName, ''); const receipt = await tx.wait(); setMessage(`Raw material registered. Transaction: ${receipt.hash}`); return; }
      const stage = kind === 'manufacture' ? 'Shipped' : kind === 'distribute' ? 'InTransit' : kind === 'deliver' ? 'Delivered' : 'Dispensed';
      const destination = kind === 'manufacture' ? sender : recipient;
      if (!ethers.isAddress(destination)) throw new Error('Enter a valid recipient wallet address.');
      const data = { batchId, drugName: drugName || 'On-chain batch', fromAddress: sender, toAddress: destination, fromRole: roleName[role], toRole: kind === 'manufacture' ? 'Manufacturer' : kind === 'distribute' ? 'Distributor' : kind === 'deliver' ? 'Pharmacy' : 'Consumer', stage, timestamp: Math.floor(Date.now() / 1000) };
      // Must match backend/services/cryptoService.createTransferPayload exactly.
      const canonical = { batchId: String(data.batchId), drugName: data.drugName.trim(), fromAddress: data.fromAddress.toLowerCase(), toAddress: data.toAddress.toLowerCase(), fromRole: data.fromRole.trim(), toRole: data.toRole.trim(), stage: data.stage.trim(), timestamp: String(data.timestamp), txHash: '' };
      const payload = JSON.stringify(canonical, Object.keys(canonical).sort());
      const signature = await signer.signMessage(ethers.getBytes(ethers.keccak256(ethers.toUtf8Bytes(payload))));
      if (kind === 'manufacture') tx = await contract.manufactureBatch(batchId); else if (kind === 'distribute') tx = await contract.transferToDistributor(batchId, recipient); else if (kind === 'deliver') tx = await contract.transferToPharmacy(batchId, recipient); else tx = await contract.dispenseToPatient(batchId, recipient);
      const receipt = await tx.wait();
      await apiService.saveSupplyChainAudit(batchId, { action: kind.toUpperCase(), signature, payload: data, expectedAddress: sender, txHash: receipt.hash });
      setMessage(`Stage updated and signed audit saved: ${receipt.hash}`);
    } catch (e) { setMessage(e.shortMessage || e.message); }
  };
  return <main className="card" style={{ maxWidth: 720, margin: '35px auto' }}><h1>Stakeholder Lifecycle Portal</h1><p>Wallet: {account || 'Not connected'} · Role: {roleName[role]}</p><button className="btn" onClick={connect}>Connect MetaMask</button><hr />
    <label>Drug name <input value={drugName} onChange={(e) => setDrugName(e.target.value)} /></label>{role === 1 && <button className="btn" onClick={() => submit('create')}>Add raw material</button>}
    <label>Batch ID <input value={batchId} onChange={(e) => setBatchId(e.target.value)} /></label>{role > 1 && role < 5 && <><label>Recipient wallet (not needed for manufacture) <input value={recipient} onChange={(e) => setRecipient(e.target.value)} /></label><div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>{role === 2 && <><button className="btn" onClick={() => submit('manufacture')}>Manufacture</button><button className="btn" onClick={() => submit('distribute')}>Ship to distributor</button></>}{role === 3 && <button className="btn" onClick={() => submit('deliver')}>Deliver to pharmacy</button>}{role === 4 && <button className="btn" onClick={() => submit('dispense')}>Dispense to patient</button>}</div></>}
    {message && <p style={{ wordBreak: 'break-word', marginTop: 16 }}>{message}</p>}</main>;
}
