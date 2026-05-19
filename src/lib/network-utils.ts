import ipaddr from 'ipaddr.js';

export interface IPInfo {
  address: string;
  version: 4 | 6;
  kind: string;
  prefixLength: number;
  mask: string;
  network: string;
  broadcast?: string;
  firstHost: string;
  lastHost: string;
  totalHosts: string;
  binary?: string;
}

export function parseIPRange(input: string): IPInfo | null {
  try {
    let addrStr = input.trim();
    let prefixLength: number;

    if (addrStr.includes('/')) {
      const parts = addrStr.split('/');
      addrStr = parts[0];
      prefixLength = parseInt(parts[1], 10);
    } else {
      const addr = ipaddr.parse(addrStr);
      prefixLength = addr.kind() === 'ipv4' ? 32 : 128;
    }

    const addr = ipaddr.parse(addrStr);
    const version = addr.kind() === 'ipv4' ? 4 : 6;

    if (version === 4) {
      const ipv4Addr = addr as ipaddr.IPv4;
      const mask = getMask(4, prefixLength);
      const network = getNetwork(ipv4Addr, prefixLength);
      const broadcast = getBroadcast(ipv4Addr, prefixLength);
      
      const networkAddr = ipaddr.IPv4.parse(network);
      const broadcastAddr = ipaddr.IPv4.parse(broadcast);
      
      const firstHost = prefixLength <= 30 ? incrementIPv4(networkAddr) : network;
      const lastHost = prefixLength <= 30 ? decrementIPv4(broadcastAddr) : broadcast;
      const totalHosts = prefixLength >= 32 ? '1' : (Math.pow(2, 32 - prefixLength) - (prefixLength <= 30 ? 2 : 0)).toString();

      return {
        address: addrStr,
        version: 4,
        kind: addr.range(),
        prefixLength,
        mask,
        network,
        broadcast,
        firstHost,
        lastHost,
        totalHosts,
        binary: toBinary(ipv4Addr)
      };
    } else {
      const ipv6Addr = addr as ipaddr.IPv6;
      const network = getNetworkV6(ipv6Addr, prefixLength);
      // For IPv6, we don't usually talk about "broadcast" but "last address"
      const last = getLastV6(ipv6Addr, prefixLength);
      
      const totalHosts = BigInt(2) ** BigInt(128 - prefixLength);

      return {
        address: addrStr,
        version: 6,
        kind: addr.range(),
        prefixLength,
        mask: `/${prefixLength}`,
        network,
        firstHost: network, // In IPv6 the first addr is usually valid for a host if not subnetted
        lastHost: last,
        totalHosts: totalHosts.toString()
      };
    }
  } catch (e) {
    return null;
  }
}

function toBinary(addr: ipaddr.IPv4): string {
  return addr.toByteArray().map(b => b.toString(2).padStart(8, '0')).join('.');
}

function getMask(version: 4 | 6, prefix: number): string {
  if (version === 4) {
    const mask = [];
    for (let i = 0; i < 4; i++) {
        const n = Math.min(Math.max(prefix - (i * 8), 0), 8);
        mask.push(256 - Math.pow(2, 8 - n));
    }
    return mask.join('.');
  }
  return `/${prefix}`;
}

function getNetwork(addr: ipaddr.IPv4, prefix: number): string {
  const bytes = addr.toByteArray();
  const maskBytes = getMaskBytes(4, prefix);
  const netBytes = bytes.map((b, i) => b & maskBytes[i]);
  return netBytes.join('.');
}

function getBroadcast(addr: ipaddr.IPv4, prefix: number): string {
  const bytes = addr.toByteArray();
  const maskBytes = getMaskBytes(4, prefix);
  const bcBytes = bytes.map((b, i) => b | (255 ^ maskBytes[i]));
  return bcBytes.join('.');
}

function getMaskBytes(version: 4 | 6, prefix: number): number[] {
  const bytes = [];
  const total = version === 4 ? 4 : 16;
  for (let i = 0; i < total; i++) {
    const n = Math.min(Math.max(prefix - (i * 8), 0), 8);
    bytes.push(256 - Math.pow(2, 8 - n));
  }
  return bytes;
}

function incrementIPv4(addr: ipaddr.IPv4): string {
  const bytes = addr.toByteArray();
  for (let i = 3; i >= 0; i--) {
    if (bytes[i] < 255) {
      bytes[i]++;
      break;
    } else {
      bytes[i] = 0;
    }
  }
  return bytes.join('.');
}

function decrementIPv4(addr: ipaddr.IPv4): string {
  const bytes = addr.toByteArray();
  for (let i = 3; i >= 0; i--) {
    if (bytes[i] > 0) {
      bytes[i]--;
      break;
    } else {
      bytes[i] = 255;
    }
  }
  return bytes.join('.');
}

function getNetworkV6(addr: ipaddr.IPv6, prefix: number): string {
    const parts = addr.toNormalizedString().split(':');
    // This is simplified, ipaddr.js has native methods for CIDR
    // but we can use subnet() if we have a range
    const range = [addr, prefix] as [ipaddr.IPv6, number];
    // Actually ipaddr.js can do:
    // var addr = ipaddr.parse("2001:db8:1234::1");
    // var range = ipaddr.parseCIDR("2001:db8:1234::/48");
    // if (addr.match(range)) { ... }
    
    // Creating a proper masked address for IPv6
    const bytes = addr.toByteArray();
    const maskBytes = getMaskBytes(6, prefix);
    const netBytes = bytes.map((b, i) => b & maskBytes[i]);
    return ipaddr.fromByteArray(netBytes).toString();
}

function getLastV6(addr: ipaddr.IPv6, prefix: number): string {
    const bytes = addr.toByteArray();
    const maskBytes = getMaskBytes(6, prefix);
    const lastBytes = bytes.map((b, i) => b | (255 ^ maskBytes[i]));
    return ipaddr.fromByteArray(lastBytes).toString();
}

// Subnetting Logic
export interface Subnet {
  name: string;
  network: string;
  mask: string;
  prefix: number;
  firstHost: string;
  lastHost: string;
  broadcast?: string;
  hosts: string;
}

export function calculateSubnets(baseNetwork: string, basePrefixChar: number, newPrefix: number): Subnet[] {
  if (newPrefix <= basePrefixChar) return [];
  const numSubnets = Math.pow(2, Math.min(newPrefix - basePrefixChar, 31)); // Cap calculation
  const subnets: Subnet[] = [];
  
  const base = ipaddr.parse(baseNetwork);
  let currentNet = baseNetwork;

  for (let i = 0; i < Math.min(numSubnets, 1024); i++) {
     const info = parseIPRange(`${currentNet}/${newPrefix}`);
     if (info) {
       subnets.push({
         name: `Subnet ${i + 1}`,
         network: info.network,
         mask: info.mask,
         prefix: newPrefix,
         firstHost: info.firstHost,
         lastHost: info.lastHost,
         broadcast: info.broadcast,
         hosts: info.totalHosts
       });
       
       const next = getNextSubnet(info.network, newPrefix);
       if (!next) break;
       currentNet = next;
     } else {
       break;
     }
  }
  return subnets;
}

function ipv4ToLong(ip: ipaddr.IPv4): number {
  const b = ip.toByteArray();
  return (b[0] << 24 | b[1] << 16 | b[2] << 8 | b[3]) >>> 0;
}

function longToIPv4(long: number): string {
  return [
    (long >>> 24) & 0xff,
    (long >>> 16) & 0xff,
    (long >>> 8) & 0xff,
    long & 0xff
  ].join('.');
}

// VLSM
export interface VLSMRequirement {
  id: string;
  name: string;
  hosts: number;
}

export function calculateVLSM(baseNetwork: string, basePrefix: number, requirements: VLSMRequirement[]): Subnet[] {
   const sorted = [...requirements].sort((a, b) => b.hosts - a.hosts);
   const results: Subnet[] = [];
   const base = ipaddr.parse(baseNetwork);
   const version = base.kind() === 'ipv4' ? 4 : 6;
   
   let currentNet = baseNetwork;

   for (const req of sorted) {
       const prefix = getPrefixForHosts(req.hosts, version as 4 | 6);
       const info = parseIPRange(`${currentNet}/${prefix}`);
       
       if (info) {
           results.push({
               name: req.name || `Subnet (${req.hosts} hosts)`,
               network: info.network,
               mask: info.mask,
               prefix: prefix,
               firstHost: info.firstHost,
               lastHost: info.lastHost,
               broadcast: info.broadcast,
               hosts: info.totalHosts
           });
           
           const next = getNextSubnet(info.network, prefix);
           if (!next) break;
           currentNet = next;
       }
   }
   return results;
}

export interface UsageProposal {
  title: string;
  description: string;
  hardware?: string;
}

export function getUsageProposals(info: IPInfo): UsageProposal[] {
  const proposals: UsageProposal[] = [];

  if (info.version === 4) {
    // Private Space
    if (info.kind === 'private') {
      proposals.push({
        title: 'Internal Corporate Network',
        description: 'Ideal for internal LAN segments. Does not require public IP registration. Must use NAT to access the Internet.',
        hardware: 'Enterprise Router / Firewall'
      });
    }

    // Specific Prefix sizes
    if (info.prefixLength >= 30) {
      proposals.push({
        title: 'Point-to-Point Link',
        description: 'Minimal address waste for direct router-to-router connections.',
        hardware: 'WAN interfaces / Layer 3 Links'
      });
    } else if (info.prefixLength >= 27) {
      proposals.push({
        title: 'Server DMZ / Small Office',
        description: 'Provide a secure, isolated segment for critical infrastructure or small branch offices.',
        hardware: 'Managed Switch (VLAN)'
      });
    } else if (info.prefixLength >= 22) {
      proposals.push({
        title: 'User Access Layer',
        description: 'Standard density for floor switches or department-wide wireless segments.',
        hardware: 'Core/Distribution Switch'
      });
    }

    // Special kinds
    if (info.address.startsWith('127.')) {
      proposals.push({
        title: 'Local Loopback',
        description: 'Used for software testing and internal process communication within the same machine.',
        hardware: 'None (Local Loopback Interface)'
      });
    }
  } else {
    // IPv6 Proposals
    if (info.prefixLength === 64) {
      proposals.push({
        title: 'SLAAC Standard Subnet',
        description: 'The standard size for a single subnet in IPv6 to support Stateless Address Autoconfiguration.',
        hardware: 'IPv6 Enabled Router'
      });
    }
    if (info.address.startsWith('fe80:')) {
      proposals.push({
        title: 'Link-Local Communication',
        description: 'Used for neighbor discovery and initial connectivity within a single physical link.',
        hardware: 'All IPv6 Devices'
      });
    }
  }

  return proposals;
}

// Advanced Subnetting Tools
export function getNextSubnet(baseNetwork: string, prefix: number): string | null {
  try {
    const addr = ipaddr.parse(baseNetwork);
    if (addr.kind() === 'ipv4') {
      const long = ipv4ToLong(addr as ipaddr.IPv4);
      const step = Math.pow(2, 32 - prefix);
      return longToIPv4(long + step);
    } else {
      const bytes = addr.toByteArray();
      const nextBytes = [...bytes];
      let carry = 1;
      
      const byteIndex = Math.floor((prefix - 1) / 8);
      const bitOffset = 7 - ((prefix - 1) % 8);
      const incrementValue = 1 << bitOffset;

      const val = nextBytes[byteIndex] + incrementValue;
      if (val > 255) {
          nextBytes[byteIndex] = 0;
          carry = 1;
          for (let i = byteIndex - 1; i >= 0; i--) {
              const v = nextBytes[i] + carry;
              if (v > 255) {
                  nextBytes[i] = 0;
                  carry = 1;
              } else {
                  nextBytes[i] = v;
                  carry = 0;
                  break;
              }
          }
      } else {
          nextBytes[byteIndex] = val;
      }
      return ipaddr.fromByteArray(nextBytes).toString();
    }
  } catch (e) {
    return null;
  }
}

export function getPrefixForHosts(hosts: number, version: 4 | 6 = 4): number {
  const totalBits = version === 4 ? 32 : 128;
  const needed = hosts + (version === 4 ? 2 : 0);
  const bits = Math.ceil(Math.log2(needed));
  return Math.max(0, totalBits - bits);
}

export function aggregateRoutes(networks: string[]): string {
  if (networks.length === 0) return '';
  if (networks.length === 1) return networks[0];

  try {
    const addresses = networks.map(n => {
        const addr = n.includes('/') ? n.split('/')[0] : n;
        return ipaddr.parse(addr);
    });

    if (addresses.some(a => a.kind() !== addresses[0].kind())) {
        throw new Error('Mixed IPv4 and IPv6 not supported for aggregation');
    }

    if (addresses[0].kind() === 'ipv4') {
        const longs = (addresses as ipaddr.IPv4[]).map(ipv4ToLong);
        const min = Math.min(...longs);
        const max = Math.max(...longs);
        
        const diff = min ^ max;
        const sigBits = diff === 0 ? 32 : 31 - Math.floor(Math.log2(diff));
        
        // Find masks
        const commonPrefix = sigBits; 
        // We also need to mask the min address with the common prefix
        const info = parseIPRange(`${longToIPv4(min)}/${commonPrefix}`);
        return info ? `${info.network}/${commonPrefix}` : '';
    } else {
        // Simple IPv6 aggregation logic
        // Find how many bits are common from the start
        const byteArrays = (addresses as ipaddr.IPv6[]).map(a => a.toByteArray());
        let commonBits = 0;
        for (let i = 0; i < 16; i++) {
            let commonByte = 0;
            for (let bit = 7; bit >= 0; bit--) {
                const bitVal = (byteArrays[0][i] >> bit) & 1;
                let match = true;
                for (let j = 1; j < byteArrays.length; j++) {
                    if (((byteArrays[j][i] >> bit) & 1) !== bitVal) {
                        match = false;
                        break;
                    }
                }
                if (match) commonBits++;
                else break;
            }
            if (commonBits % 8 !== 0 || i*8 + 8 > commonBits) break;
        }
        
        const info = parseIPRange(`${addresses[0].toString()}/${commonBits}`);
        return info ? `${info.network}/${commonBits}` : '';
    }
  } catch (e) {
    return 'Invalid input';
  }
}
