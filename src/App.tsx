/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from 'react';
import { 
  Search, 
  Layers, 
  Network, 
  Info, 
  ChevronRight, 
  Copy, 
  Check, 
  Minus, 
  Plus, 
  LayoutGrid, 
  Smartphone, 
  ArrowUpRight,
  ClipboardList
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { 
  parseIPRange, 
  calculateSubnets, 
  calculateVLSM, 
  aggregateRoutes,
  getUsageProposals,
  getNextSubnet,
  getPrefixForHosts,
  type IPInfo,
  type Subnet,
  type VLSMRequirement,
  type UsageProposal
} from './lib/network-utils.ts';
import { 
  Download, 
  BookOpen, 
  Cpu, 
  ShieldCheck, 
  Server, 
  Trash2,
  HelpCircle,
  Calculator,
  ArrowRight
} from 'lucide-react';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Components
const Tooltip = ({ children, content }: { children: React.ReactNode; content: string }) => {
  const [show, setShow] = useState(false);
  return (
    <div className="relative inline-block" onMouseEnter={() => setShow(true)} onMouseLeave={() => setShow(false)}>
      {children}
      <AnimatePresence>
        {show && (
          <motion.div
            initial={{ opacity: 0, y: 5, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 5, scale: 0.95 }}
            className="absolute z-50 px-3 py-2 text-[10px] font-bold text-white bg-slate-900 rounded shadow-xl whitespace-nowrap bottom-full left-1/2 -translate-x-1/2 mb-2 pointer-events-none uppercase tracking-widest border border-white/10"
          >
            {content}
            <div className="absolute top-full left-1/2 -translate-x-1/2 border-8 border-transparent border-t-slate-900" />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

const Card = ({ children, className, id, ...rest }: { children: React.ReactNode; className?: string; id?: string; [key: string]: any }) => (
  <div id={id} className={cn("bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm", className)} {...rest}>
    {children}
  </div>
);

const NavButton = ({ active, onClick, icon: Icon, label, tooltip }: { active: boolean; onClick: () => void; icon: any; label: string; tooltip: string }) => (
  <Tooltip content={tooltip}>
    <button
      onClick={onClick}
      className={cn(
        "px-1 py-4 text-sm font-medium transition-colors relative",
        active 
          ? "text-blue-600" 
          : "text-slate-500 hover:text-slate-800"
      )}
    >
      <div className="flex items-center gap-2">
        <Icon className="w-4 h-4" />
        {label}
      </div>
      {active && <motion.div layoutId="nav-underline" className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600" />}
    </button>
  </Tooltip>
);

const CopyButton = ({ text, tooltip = "Copy to clipboard" }: { text: string; tooltip?: string }) => {
  const [copied, setCopied] = useState(false);
  const handleCopy = () => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <Tooltip content={copied ? "Copied!" : tooltip}>
      <button onClick={handleCopy} className="text-slate-400 hover:text-slate-600 transition-colors">
        {copied ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
      </button>
    </Tooltip>
  );
};

export default function App() {
  const [activeTab, setActiveTab] = useState<'inspector' | 'subnet' | 'vlsm' | 'aggregator' | 'guide' | 'tools'>('inspector');
  const [inputIP, setInputIP] = useState('192.168.10.45/26');
  
  // Subnetting states
  const [newPrefix, setNewPrefix] = useState(28);
  
  // Tool states
  const [hostCalcInput, setHostCalcInput] = useState('50');
  const [prefixCalcInput, setPrefixCalcInput] = useState('24');
  const [nextSubnetInput, setNextSubnetInput] = useState('192.168.10.0/26');
  
  // VLSM states
  const [vlsmRequirements, setVlsmRequirements] = useState<VLSMRequirement[]>([
    { id: '1', name: 'VLAN-10-MGMT', hosts: 10 },
    { id: '2', name: 'VLAN-20-PROD', hosts: 14 },
    { id: '3', name: 'VLAN-30-DEV', hosts: 6 },
  ]);

  // Aggregator states
  const [aggInputs, setAggInputs] = useState<string>('192.168.10.0/28\n192.168.10.16/28\n192.168.10.32/29');

  const ipInfo = useMemo(() => parseIPRange(inputIP), [inputIP]);

  const subnets = useMemo(() => {
    if (!ipInfo) return [];
    return calculateSubnets(ipInfo.network, ipInfo.prefixLength, newPrefix);
  }, [ipInfo, newPrefix]);

  const vlsmSubnets = useMemo(() => {
    if (!ipInfo) return [];
    return calculateVLSM(ipInfo.network, ipInfo.prefixLength, vlsmRequirements);
  }, [ipInfo, vlsmRequirements]);

  const supernet = useMemo(() => {
    const lines = aggInputs.split('\n').map(l => l.trim()).filter(l => l);
    return aggregateRoutes(lines);
  }, [aggInputs]);

  const proposals = useMemo(() => {
    if (!ipInfo) return [];
    return getUsageProposals(ipInfo);
  }, [ipInfo]);

  const exportToCSV = (data: Subnet[], filename: string) => {
    const headers = ['Name', 'Network', 'Mask', 'Prefix', 'First Host', 'Last Host', 'Broadcast', 'Hosts'];
    const rows = data.map(s => [s.name, s.network, s.mask, s.prefix, s.firstHost, s.lastHost, s.broadcast || '', s.hosts]);
    const csvContent = "data:text/csv;charset=utf-8," + 
      [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="flex flex-col h-screen bg-slate-50 font-sans text-slate-800 overflow-hidden">
      {/* Top Navigation Bar */}
      <header className="h-16 flex items-center justify-between px-8 bg-white border-b border-slate-200 shadow-sm shrink-0">
        <div className="flex items-center space-x-3">
          <div className="w-8 h-8 bg-blue-600 rounded flex items-center justify-center">
            <div className="w-4 h-4 border-2 border-white rounded-sm"></div>
          </div>
          <span className="text-xl font-bold tracking-tight text-slate-900">Net<span className="text-blue-600">Architect</span></span>
        </div>
        <nav className="hidden md:flex items-center space-x-8">
          <NavButton active={activeTab === 'inspector'} onClick={() => setActiveTab('inspector')} icon={Info} label="Inspector" tooltip="View IP details and ranges" />
          <NavButton active={activeTab === 'subnet'} onClick={() => setActiveTab('subnet')} icon={Layers} label="Subneter" tooltip="Divide network into subnets" />
          <NavButton active={activeTab === 'vlsm'} onClick={() => setActiveTab('vlsm')} icon={LayoutGrid} label="VLSM Builder" tooltip="Variable Length Subnet Masking" />
          <NavButton active={activeTab === 'aggregator'} onClick={() => setActiveTab('aggregator')} icon={ArrowUpRight} label="Aggregator" tooltip="Merge multiple routes" />
          <NavButton active={activeTab === 'tools'} onClick={() => setActiveTab('tools')} icon={Calculator} label="Quick Tools" tooltip="Helpers and calculators" />
          <NavButton active={activeTab === 'guide'} onClick={() => setActiveTab('guide')} icon={BookOpen} label="Guide" tooltip="Learn about networking" />
        </nav>
        <div className="flex items-center gap-4">
          <div className="px-3 py-1 bg-slate-100 rounded-full text-[10px] font-bold text-slate-500 uppercase tracking-wider">v4.2.1 Stable</div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 p-6 grid grid-cols-12 gap-6 overflow-hidden">
        {/* Sidebar / Input Section */}
        <section className="col-span-4 flex flex-col space-y-6 overflow-y-auto pr-2 no-scrollbar">
          <Card className="p-6 shrink-0">
            <h2 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4">Input Configuration</h2>
            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-semibold text-slate-700">IP Address / CIDR</label>
                <Tooltip content="Paste your IP or CIDR range here">
                  <div className="relative group">
                    <input 
                      type="text" 
                      value={inputIP}
                      onChange={(e) => setInputIP(e.target.value)}
                      className="w-full p-3 bg-slate-50 border border-slate-200 rounded-lg text-lg font-mono text-slate-900 focus:ring-2 focus:ring-blue-500 outline-none transition-all" 
                      placeholder="192.168.10.0/24"
                    />
                    <div className="absolute right-3 top-3 text-slate-400">
                      <Search className="w-5 h-5" />
                    </div>
                  </div>
                </Tooltip>
                {!ipInfo && inputIP && <p className="text-[10px] text-red-500 font-bold uppercase">Invalid Format</p>}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-500 uppercase">Current Mask</label>
                  <div className="p-2 bg-slate-100 rounded text-center font-mono text-xs">{ipInfo?.mask || 'N/A'}</div>
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-500 uppercase">Max Hosts</label>
                  <div className="p-2 bg-slate-100 rounded text-center font-mono text-xs">
                    {ipInfo ? (BigInt(ipInfo.totalHosts) > BigInt(1000000000) ? Number(ipInfo.totalHosts).toExponential(2) : BigInt(ipInfo.totalHosts).toLocaleString()) : 'N/A'}
                  </div>
                </div>
              </div>

              {activeTab === 'subnet' && (
                <div className="pt-4 border-t border-slate-100">
                  <label className="text-sm font-semibold text-slate-700 mb-2 block">Target Prefix</label>
                  <div className="flex items-center gap-4 bg-slate-100 p-2 rounded-xl">
                    <Tooltip content="Increase host bits / Decrease prefix length">
                      <button 
                        onClick={() => setNewPrefix(p => Math.max(p - 1, (ipInfo?.prefixLength || 0) + 1))}
                        className="p-2 hover:bg-slate-200 rounded-lg transition-colors"
                      >
                        <Minus className="w-4 h-4" />
                      </button>
                    </Tooltip>
                    <span className="font-mono text-xl flex-1 text-center font-bold">/{newPrefix}</span>
                    <Tooltip content="Decrease host bits / Increase prefix length">
                      <button 
                        onClick={() => setNewPrefix(p => Math.min(p + 1, 128))}
                        className="p-2 hover:bg-slate-200 rounded-lg transition-colors"
                      >
                        <Plus className="w-4 h-4" />
                      </button>
                    </Tooltip>
                  </div>
                </div>
              )}
            </div>
          </Card>

          {/* Assistant / Binary Visualizer */}
          <div className="flex-1 space-y-6">
             {ipInfo?.binary && (
               <Card className="p-6 overflow-hidden">
                 <h2 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4">Binary Visualization</h2>
                 <div className="font-mono text-[11px] leading-relaxed space-y-4">
                   <div>
                     <div className="text-slate-400 mb-1">Address (Bin)</div>
                     <div className="p-3 bg-slate-50 rounded border border-slate-100 flex flex-wrap gap-1">
                        {ipInfo.binary.split('.').map((octet, i) => (
                           <span key={i} className={cn(i < Math.floor(ipInfo.prefixLength / 8) ? "text-blue-600 font-bold" : "text-slate-600")}>
                             {octet}{i < 3 ? '.' : ''}
                           </span>
                        ))}
                     </div>
                   </div>
                   <div className="pt-4 border-t border-slate-100">
                     <div className="flex justify-between items-center text-xs py-2">
                       <span className="text-slate-500">Network Portion</span>
                       <span className="font-bold">{ipInfo.prefixLength} Bits</span>
                     </div>
                     <div className="flex justify-between items-center text-xs py-2">
                       <span className="text-slate-500">Host Portion</span>
                       <span className="font-bold">{ipInfo.version === 4 ? 32 - ipInfo.prefixLength : 128 - ipInfo.prefixLength} Bits</span>
                     </div>
                   </div>
                 </div>
               </Card>
             )}

             <Card className="p-6 bg-slate-900 text-white border-0">
               <div className="flex items-center gap-3 mb-4">
                 <div className="p-2 bg-blue-600 rounded-lg">
                   <Network className="w-4 h-4" />
                 </div>
                 <h3 className="text-sm font-bold">Design Insight</h3>
               </div>
               <p className="text-xs text-slate-400 leading-relaxed italic">
                 {activeTab === 'inspector' && "Ideal for understanding the scope of your current assignment. Check the Usable Range carefully for Gateway placement."}
                 {activeTab === 'subnet' && `You are dividing into /${newPrefix} blocks. This creates ${subnets.length} segments with ${subnets[0]?.hosts} hosts each.`}
                 {activeTab === 'vlsm' && "VLSM minimizes IP waste. Always start with the largest subnet requirement to ensure efficient allocation."}
                 {activeTab === 'aggregator' && "Aggregation reduces routing table overhead. Ensure all networks share a common high-order bit pattern."}
               </p>
             </Card>

             <Card className="p-6">
                <h4 className="text-[10px] font-bold text-slate-400 uppercase mb-4 tracking-wider">Cheat Sheet</h4>
                <div className="space-y-1">
                  <CheatSheetRow prefix="/30" mask=".252" hosts="2" />
                  <CheatSheetRow prefix="/29" mask=".248" hosts="6" />
                  <CheatSheetRow prefix="/28" mask=".240" hosts="14" />
                  <CheatSheetRow prefix="/27" mask=".224" hosts="30" />
                  <CheatSheetRow prefix="/24" mask=".0" hosts="254" />
                </div>
             </Card>
          </div>
        </section>

        {/* Main Data / Results Section */}
        <section className="col-span-8 flex flex-col space-y-6 overflow-hidden">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="flex flex-col h-full space-y-6"
            >
              {activeTab === 'inspector' && ipInfo && (
                <div className="space-y-6 overflow-y-auto no-scrollbar pb-6">
                  <div className="grid grid-cols-3 gap-4">
                    <StatsCard label="Network ID" value={ipInfo.network} mono />
                    <StatsCard label="Broadcast" value={ipInfo.broadcast || 'N/A'} mono />
                    <StatsCard label="Usable Range" value={`${ipInfo.firstHost} — ${ipInfo.lastHost}`} blue />
                  </div>
                  
                  <div className="grid grid-cols-2 gap-6">
                    <StatsCard label="Netmask" value={ipInfo.mask} mono />
                    <StatsCard label="Total Capacity" value={(BigInt(ipInfo.totalHosts) > BigInt(1000000000) ? Number(ipInfo.totalHosts).toExponential(2) : BigInt(ipInfo.totalHosts).toLocaleString()) + " Hosts"} />
                  </div>

                    <Card className="flex-1">
                    <div className="p-4 border-b border-slate-100 bg-slate-50/50 flex justify-between items-center">
                       <h2 className="text-sm font-bold text-slate-700">Detailed Characteristics</h2>
                    </div>
                    <div className="p-6 space-y-4 text-sm">
                       <div className="flex justify-between border-b border-slate-100 pb-2">
                         <span className="text-slate-500">Address Kind</span>
                         <span className="font-bold text-blue-600 uppercase tracking-widest text-[10px] bg-blue-50 px-2 py-0.5 rounded">{ipInfo.kind}</span>
                       </div>
                       <div className="flex justify-between border-b border-slate-100 pb-2">
                         <span className="text-slate-500">IP Version</span>
                         <span className="font-bold">IPv{ipInfo.version}</span>
                       </div>
                       <div className="flex justify-between border-b border-slate-100 pb-2">
                         <span className="text-slate-500">Reverse DNS Pointer</span>
                         <span className="font-mono text-xs">{ipInfo.network.split('.').reverse().join('.')}.in-addr.arpa</span>
                       </div>
                    </div>
                  </Card>

                  {proposals.length > 0 && (
                    <div className="space-y-4">
                      <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest">Recommended Use Cases</h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {proposals.map((p, i) => (
                          <Card key={i} className="p-5 border-l-4 border-l-blue-600">
                             <div className="flex items-start gap-3">
                                <div className="p-2 bg-blue-50 rounded-lg text-blue-600 shrink-0">
                                   <Server className="w-4 h-4" />
                                </div>
                                <div>
                                   <h4 className="font-bold text-sm text-slate-900">{p.title}</h4>
                                   <p className="text-xs text-slate-500 mt-1 leading-relaxed">{p.description}</p>
                                   {p.hardware && <p className="text-[10px] font-bold text-blue-500 uppercase mt-2">Common: {p.hardware}</p>}
                                </div>
                             </div>
                          </Card>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {activeTab === 'subnet' && (
                <Card className="flex-1 flex flex-col overflow-hidden shadow-lg border-blue-100">
                  <div className="p-4 border-b border-slate-100 bg-slate-50/50 flex justify-between items-center shrink-0">
                    <h2 className="text-sm font-bold text-slate-700">Subnet Segments</h2>
                    <div className="flex items-center gap-3">
                      <Tooltip content="Download subnet table as CSV">
                        <button 
                          onClick={() => exportToCSV(subnets, 'subnets.csv')}
                          className="px-3 py-1 flex items-center gap-2 bg-white border border-slate-200 rounded-lg text-[10px] font-bold hover:bg-slate-50 transition-colors"
                        >
                          <Download className="w-3 h-3" /> EXPORT
                        </button>
                      </Tooltip>
                      <span className="text-[10px] bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-bold uppercase">Proposal for /{newPrefix}</span>
                    </div>
                  </div>
                  <div className="flex-1 overflow-y-auto">
                    <table className="w-full text-left border-collapse">
                      <thead className="text-[10px] font-bold text-slate-400 bg-white sticky top-0 uppercase tracking-widest">
                        <tr>
                          <th className="px-6 py-4 border-b border-slate-100">Index</th>
                          <th className="px-6 py-4 border-b border-slate-100">Network Address</th>
                          <th className="px-6 py-4 border-b border-slate-100">Host Range</th>
                          <th className="px-6 py-4 border-b border-slate-100">Broadcast</th>
                          <th className="px-6 py-4 border-b border-slate-100 text-right">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 text-xs font-mono">
                        {subnets.map((sub, i) => (
                          <tr key={i} className="hover:bg-blue-50/30 transition-colors group">
                            <td className="px-6 py-4 text-slate-400">#{i + 1}</td>
                            <td className="px-6 py-4 font-bold text-slate-900">{sub.network}/{sub.prefix}</td>
                            <td className="px-6 py-4 text-slate-500">{sub.firstHost} — {sub.lastHost}</td>
                            <td className="px-6 py-4 text-slate-400">{sub.broadcast || 'N/A'}</td>
                            <td className="px-6 py-4 text-right">
                              <CopyButton text={`${sub.network}/${sub.prefix}`} />
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </Card>
              )}

              {activeTab === 'vlsm' && (
                <div className="flex flex-col h-full space-y-6 overflow-hidden">
                  <Card className="p-6 shrink-0">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="font-bold text-sm">Requirements Planner</h3>
                      <Tooltip content="Add a new network segment requirement">
                        <button 
                          onClick={() => setVlsmRequirements([...vlsmRequirements, { id: Math.random().toString(), name: `VLAN-${vlsmRequirements.length + 1}0`, hosts: 10 }])}
                          className="px-3 py-1.5 bg-blue-600 text-white text-[10px] font-bold rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2 uppercase tracking-widest"
                        >
                          <Plus className="w-3 h-3" /> Add VLAN
                        </button>
                      </Tooltip>
                    </div>
                    <div className="grid grid-cols-2 gap-3 max-h-40 overflow-y-auto pr-2 no-scrollbar">
                       {vlsmRequirements.map((req, i) => (
                         <div key={req.id} className="flex items-center gap-2 bg-slate-50 p-2 rounded-lg border border-slate-100">
                           <input 
                             type="text" 
                             value={req.name}
                             onChange={(e) => {
                               const next = [...vlsmRequirements];
                               next[i].name = e.target.value;
                               setVlsmRequirements(next);
                             }}
                             className="text-[11px] font-semibold bg-transparent border-none focus:ring-0 w-full"
                             placeholder="Name"
                           />
                           <input 
                             type="number" 
                             value={req.hosts}
                             onChange={(e) => {
                               const next = [...vlsmRequirements];
                               next[i].hosts = parseInt(e.target.value) || 0;
                               setVlsmRequirements(next);
                             }}
                             className="text-[11px] font-mono text-center w-12 bg-white border border-slate-200 rounded px-1"
                           />
                           <button onClick={() => setVlsmRequirements(vlsmRequirements.filter(r => r.id !== req.id))} className="text-slate-300 hover:text-red-500">
                             <Minus className="w-3 h-3" />
                           </button>
                         </div>
                       ))}
                    </div>
                  </Card>

                   <Card className="flex-1 overflow-hidden flex flex-col">
                    <div className="p-4 border-b border-slate-100 bg-slate-50/50 flex justify-between items-center shrink-0">
                      <h2 className="text-sm font-bold text-slate-700">VLSM Allocation Table</h2>
                      <button 
                        onClick={() => exportToCSV(vlsmSubnets, 'vlsm_subnets.csv')}
                        className="px-3 py-1 flex items-center gap-2 bg-white border border-slate-200 rounded-lg text-[10px] font-bold hover:bg-slate-50 transition-colors"
                      >
                        <Download className="w-3 h-3" /> EXPORT
                      </button>
                    </div>
                    <div className="flex-1 overflow-y-auto">
                      <table className="w-full text-left">
                        <thead className="text-[10px] font-bold text-slate-400 bg-white sticky top-0 uppercase tracking-widest">
                          <tr>
                            <th className="px-6 py-4 border-b">Subnet Name</th>
                            <th className="px-6 py-4 border-b">
                              <Tooltip content="Classless Inter-Domain Routing prefix">CIDR</Tooltip>
                            </th>
                            <th className="px-6 py-4 border-b">
                              <Tooltip content="Assignable host addresses">Hosts</Tooltip>
                            </th>
                            <th className="px-6 py-4 border-b">Network ID</th>
                            <th className="px-6 py-4 border-b">Address Range</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 text-xs font-mono">
                          {vlsmSubnets.map((sub, i) => (
                            <tr key={i} className={cn("hover:bg-slate-50 transition-colors", i % 2 === 1 ? "bg-blue-50/10" : "")}>
                              <td className="px-6 py-4 font-sans font-bold text-slate-700">{sub.name}</td>
                              <td className="px-6 py-4 text-blue-600 font-bold">/{sub.prefix}</td>
                              <td className="px-6 py-4 font-bold">{sub.hosts}</td>
                              <td className="px-6 py-4 text-slate-900">{sub.network}</td>
                              <td className="px-6 py-4 text-slate-400">{sub.firstHost} — {sub.lastHost}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </Card>
                </div>
              )}

               {activeTab === 'aggregator' && (
                <div className="space-y-6">
                  <Card className="p-6">
                    <h3 className="text-sm font-bold mb-4">Target Routes for Aggregation</h3>
                    <Tooltip content="Enter one CIDR network per line to find the smallest supernet that contains them all">
                      <textarea 
                        value={aggInputs}
                        onChange={(e) => setAggInputs(e.target.value)}
                        placeholder="Paste network addresses here, one per line..."
                        className="w-full h-48 bg-slate-50 border border-slate-200 rounded-xl p-4 font-mono text-sm focus:ring-2 focus:ring-blue-500 outline-none resize-none"
                      />
                    </Tooltip>
                  </Card>
                  
                  <div className="p-8 bg-blue-600 text-white rounded-2xl shadow-xl shadow-blue-200 flex items-center justify-between">
                    <div>
                      <p className="text-[10px] uppercase tracking-widest text-blue-100 mb-1 font-bold">Aggregated Supernet Result</p>
                      <p className="text-3xl font-mono font-bold tracking-tight">{supernet || '...'}</p>
                    </div>
                    <div className="p-4 bg-white/10 rounded-2xl backdrop-blur-sm border border-white/20">
                       <CopyButton text={supernet} />
                    </div>
                  </div>
                </div>
              )}

               {activeTab === 'tools' && (
                <div className="space-y-6 overflow-y-auto no-scrollbar pb-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <Card className="p-6">
                      <h3 className="font-bold text-slate-900 mb-6 flex items-center gap-2">
                        <Calculator className="w-5 h-5 text-blue-600" /> Host Requirement Tool
                      </h3>
                      <div className="space-y-4">
                        <div>
                          <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-2">Target Hosts</label>
                          <input 
                            type="number"
                            value={hostCalcInput}
                            onChange={(e) => setHostCalcInput(e.target.value)}
                            className="w-full p-3 bg-slate-50 border border-slate-200 rounded-lg font-mono text-lg focus:ring-2 focus:ring-blue-500 outline-none"
                            placeholder="e.g. 50"
                          />
                        </div>
                        <div className="p-4 bg-blue-50 rounded-xl border border-blue-100 flex items-center justify-between">
                          <span className="text-sm font-semibold text-blue-900">Required Prefix</span>
                          <span className="text-2xl font-mono font-bold text-blue-600">/{getPrefixForHosts(parseInt(hostCalcInput) || 0, ipInfo?.version || 4)}</span>
                        </div>
                      </div>
                    </Card>

                    <Card className="p-6">
                      <h3 className="font-bold text-slate-900 mb-6 flex items-center gap-2">
                        <Layers className="w-5 h-5 text-purple-600" /> Prefix Capacity Tool
                      </h3>
                      <div className="space-y-4">
                        <div>
                          <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-2">Network Prefix</label>
                          <div className="flex items-center gap-2">
                            <span className="text-xl font-mono text-slate-400">/</span>
                            <input 
                              type="number"
                              value={prefixCalcInput}
                              onChange={(e) => setPrefixCalcInput(e.target.value)}
                              className="w-full p-3 bg-slate-50 border border-slate-200 rounded-lg font-mono text-lg focus:ring-2 focus:ring-purple-500 outline-none"
                              placeholder="24"
                              min="0"
                              max="32"
                            />
                          </div>
                        </div>
                        <div className="p-4 bg-purple-50 rounded-xl border border-purple-100 flex items-center justify-between">
                          <span className="text-sm font-semibold text-purple-900">Usable Hosts</span>
                          <span className="text-2xl font-mono font-bold text-purple-600">
                            {(() => {
                              const v = (ipInfo?.version || 4) === 4 ? 32 : 128;
                              const p = parseInt(prefixCalcInput) || v;
                              const hosts = BigInt(2) ** BigInt(v - p);
                              const usable = (ipInfo?.version || 4) === 4 ? (hosts > BigInt(1) ? hosts - BigInt(2) : BigInt(0)) : hosts; // IPv6 doesn't subtract 2 for broadcast/network in the same way for simple capacity
                              return usable > BigInt(1000000000) ? Number(usable).toExponential(2) : usable.toLocaleString();
                            })()}
                          </span>
                        </div>
                      </div>
                    </Card>
                  </div>

                  <Card className="p-6">
                    <h3 className="font-bold text-slate-900 mb-6 flex items-center gap-2">
                      <ArrowRight className="w-5 h-5 text-green-600" /> Next Subnet Calculator
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
                      <div className="space-y-4">
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">Current Subnet (CIDR)</label>
                        <input 
                          type="text"
                          value={nextSubnetInput}
                          onChange={(e) => setNextSubnetInput(e.target.value)}
                          className="w-full p-3 bg-slate-50 border border-slate-200 rounded-lg font-mono text-lg focus:ring-2 focus:ring-green-500 outline-none"
                          placeholder="192.168.1.0/24"
                        />
                        <p className="text-[10px] text-slate-400">Calculate the network address that follows this block sequentially.</p>
                      </div>
                      <div className="p-6 bg-slate-900 rounded-2xl text-white relative overflow-hidden">
                        <div className="relative z-10">
                          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">Next Usable Network</p>
                          <p className="text-2xl font-mono font-bold text-green-400">
                            {(() => {
                              const [ip, prefix] = nextSubnetInput.split('/');
                              const result = getNextSubnet(ip, parseInt(prefix) || 24);
                              return result ? `${result}/${prefix || 24}` : 'Invalid Input';
                            })()}
                          </p>
                        </div>
                        <ArrowRight className="absolute -right-4 -bottom-4 w-24 h-24 text-white/5 rotate-[-15deg]" />
                      </div>
                    </div>
                  </Card>
                </div>
              )}

               {activeTab === 'guide' && (
                <div className="space-y-6 overflow-y-auto no-scrollbar pb-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <Card className="p-6">
                       <h3 className="font-bold text-slate-900 mb-4 flex items-center gap-2">
                         <HelpCircle className="w-5 h-5 text-blue-600" /> What is Subnetting?
                       </h3>
                       <p className="text-sm text-slate-600 leading-relaxed">
                         Subnetting is the process of dividing a single large network into multiple smaller sub-networks (subnets). 
                         This is achieved by "borrowing" bits from the host portion of the IP address to extend the network portion.
                       </p>
                       <div className="mt-4 p-4 bg-slate-50 rounded-lg font-mono text-[11px] text-slate-500">
                         Formula: 2<sup>n</sup> = Number of subnets<br/>
                         where <span className="text-blue-600 font-bold">n</span> is the number of bits borrowed.
                       </div>
                    </Card>
                    <Card className="p-6">
                       <h3 className="font-bold text-slate-900 mb-4 flex items-center gap-2">
                         <ShieldCheck className="w-5 h-5 text-green-600" /> Why use VLSM?
                       </h3>
                       <p className="text-sm text-slate-600 leading-relaxed">
                         Variable Length Subnet Masking (VLSM) allows us to create subnets of different sizes within the same network. 
                         This maximizes IP address efficiency by avoiding waste on segments that only need few hosts (like router-to-router links).
                       </p>
                    </Card>
                  </div>
                  
                  <Card className="p-6">
                    <h3 className="font-bold text-slate-900 mb-6">IP Math Quick Guide</h3>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                       <div>
                         <h4 className="text-xs font-bold text-slate-400 uppercase mb-3">The Magic Number</h4>
                         <p className="text-xs text-slate-500 leading-relaxed">
                           Subtracting an octet value from 256 gives you the "Magic Number", which is the jump size between subnets.
                         </p>
                       </div>
                       <div>
                         <h4 className="text-xs font-bold text-slate-400 uppercase mb-3">Usable Hosts</h4>
                         <p className="text-xs text-slate-500 leading-relaxed">
                           Usable Hosts = (2<sup>bits</sup>) - 2. We subtract 2 for the Network ID and the Broadcast Address.
                         </p>
                       </div>
                       <div>
                         <h4 className="text-xs font-bold text-slate-400 uppercase mb-3">Wildcard Mask</h4>
                         <p className="text-xs text-slate-500 leading-relaxed">
                           Inverted subnet mask used in ACLs and OSPF. Calculated as 255.255.255.255 minus the Subnet Mask.
                         </p>
                       </div>
                    </div>
                  </Card>
                </div>
              )}
            </motion.div>
          </AnimatePresence>
        </section>
      </main>

      {/* Footer Status Bar */}
      <footer className="h-10 bg-white border-t border-slate-200 px-8 flex items-center justify-between text-[10px] font-bold text-slate-400 uppercase tracking-widest shrink-0">
        <div className="flex items-center space-x-6">
          <span className="flex items-center"><span className="w-1.5 h-1.5 bg-green-500 rounded-full mr-2"></span> ENGINE ACTIVE</span>
          <span className="hidden sm:inline">RFC 1918 COMPLIANT</span>
          <span className="hidden sm:inline">DUAL STACK READY</span>
        </div>
        <div className="flex items-center space-x-6">
          <span>{new Date().toLocaleTimeString()}</span>
          <span>AIS v4.2 PRO</span>
        </div>
      </footer>
    </div>
  );
}

function StatsCard({ label, value, mono, blue }: { label: string; value: string; mono?: boolean; blue?: boolean }) {
  return (
    <Card className={cn(
      "p-5 flex flex-col justify-between hover:shadow-md transition-shadow",
      blue ? "bg-blue-600 border-blue-700 text-white" : ""
    )}>
      <div className="flex items-center justify-between mb-1">
        <p className={cn("text-[9px] font-bold uppercase tracking-widest", blue ? "text-blue-100" : "text-slate-400")}>{label}</p>
        <CopyButton text={value} />
      </div>
      <p className={cn(
        "text-lg font-bold truncate",
        blue ? "text-white" : "text-slate-900",
        mono ? "font-mono" : ""
      )}>
        {value}
      </p>
    </Card>
  );
}

function CheatSheetRow({ prefix, mask, hosts }: { prefix: string; mask: string; hosts: string }) {
  return (
    <div className="flex items-center justify-between py-1.5 border-b border-slate-100 last:border-0 text-[10px] font-mono">
      <span className="font-bold text-slate-900 w-8">{prefix}</span>
      <span className="text-slate-400">{mask}</span>
      <span className="text-slate-500 font-bold tabular-nums">{hosts} hosts</span>
    </div>
  );
}

