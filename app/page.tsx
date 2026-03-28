import Link from 'next/link';
import { ShieldCheck, HardHat, Server } from 'lucide-react';

const roles = [
	{
		name: 'Admin',
		description: 'Regional Load Dispatch Center access',
		href: '/admin-dashboard',
		icon: ShieldCheck,
		cta: 'Open Admin Dashboard',
	},
	{
		name: 'Engineer',
		description: 'Field operations and maintenance access',
		href: '/engineer',
		icon: HardHat,
		cta: 'Open Engineer Login',
	},
	{
		name: 'Substation Manager',
		description: 'Node telemetry and station controls',
		href: '/substation-mgr-dashboard',
		icon: Server,
		cta: 'Open Manager Login',
	},
];

export default function Page() {
	return (
		<main className="min-h-screen bg-[#131313] text-white px-6 py-12 md:px-12 md:py-16">
			<div className="mx-auto max-w-6xl">
				<header className="mb-10 md:mb-14">
					<p className="text-[11px] uppercase tracking-[0.2em] text-neutral-500">Power Grid Command</p>
					<h1 className="mt-3 text-4xl md:text-6xl font-bold tracking-tight">Select Your Role</h1>
					<p className="mt-4 max-w-2xl text-neutral-400">
						Choose a portal to continue. Engineer and Substation Manager routes open directly to login.
					</p>
				</header>

				<section className="grid grid-cols-1 gap-6 md:grid-cols-3">
					{roles.map((role) => {
						const Icon = role.icon;

						return (
							<Link
								key={role.name}
								href={role.href}
								className="group rounded-sm border border-[#474747]/30 bg-[#1c1b1b] p-7 transition-all hover:border-white/50 hover:bg-[#222]"
							>
								<div className="mb-6 inline-flex h-12 w-12 items-center justify-center rounded-sm bg-[#0f0f0f] text-neutral-200 group-hover:text-white">
									<Icon className="h-6 w-6" />
								</div>
								<h2 className="text-2xl font-bold tracking-tight">{role.name}</h2>
								<p className="mt-3 text-sm text-neutral-400">{role.description}</p>
								<div className="mt-8 text-[11px] uppercase tracking-[0.14em] text-neutral-300 group-hover:text-white">
									{role.cta}
								</div>
							</Link>
						);
					})}
				</section>
			</div>
		</main>
	);
}
