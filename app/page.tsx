"use client";

import Link from 'next/link';
import { ShieldCheck, HardHat, Server } from 'lucide-react';
import { useState, useEffect, useRef } from 'react';
import styles from './page.module.css';

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
	const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
	const [glowLetters, setGlowLetters] = useState<number[]>([]);
	const textRef = useRef<HTMLDivElement>(null);
	const text = 'URJA SETU';

	useEffect(() => {
		const handleMouseMove = (e: MouseEvent) => {
			setMousePos({ x: e.clientX, y: e.clientY });

			if (textRef.current) {
				const letters = textRef.current.querySelectorAll('[data-letter-index]');
				const newGlowLetters: number[] = [];

				letters.forEach((letter) => {
					const rect = (letter as HTMLElement).getBoundingClientRect();
					const letterCenterX = rect.left + rect.width / 2;
					const letterCenterY = rect.top + rect.height / 2;

					const distance = Math.sqrt(
						Math.pow(e.clientX - letterCenterX, 2) +
							Math.pow(e.clientY - letterCenterY, 2)
					);

					// Glow effect when mouse is within 150px of letter
					if (distance < 150) {
						const index = parseInt((letter as HTMLElement).getAttribute('data-letter-index') || '0');
						newGlowLetters.push(index);
					}
				});

				setGlowLetters(newGlowLetters);
			}
		};

		window.addEventListener('mousemove', handleMouseMove);
		return () => window.removeEventListener('mousemove', handleMouseMove);
	}, []);

	return (
		<main className={styles.main}>
			<div className={styles.container}>
				<header className={styles.header}>
					<h1 className={styles.title}
					style={{
						marginBottom:'0',
					}}
					>Select Your Role</h1>
					<p className={styles.subtitle}
					style={{
						marginTop: '0',
					}}
					>
						Choose a portal to continue. Engineer and Substation Manager routes open directly to login.
					</p>
				</header>

				<section className={styles.section}>
					{roles.map((role) => {
						const Icon = role.icon;

						return (
							<Link key={role.name} href={role.href} className={styles.roleCard}>
								<div className={styles.iconBox}>
									<Icon className={styles.icon} />
								</div>
								<h2 className={styles.roleName}>{role.name}</h2>
								<p className={styles.roleDescription}>{role.description}</p>
								<div className={styles.roleCta}>{role.cta}</div>
							</Link>
						);
					})}
				</section>
			</div>

			{/* Large Background Text Effect with Individual Letter Glow */}
			<div ref={textRef} className={styles.bgTextContainer}
			style={{
				height:"100vh",
				width:"100vw",
			}}
			>
				<div className={styles.bgText}>
					{text.split('').map((letter, index) => (
						<span
							key={index}
							data-letter-index={index}
							className={`${styles.letter} ${glowLetters.includes(index) ? styles.letterGlow : ''}`}
						>
							{letter}
						</span>
					))}
				</div>
			</div>
		</main>
	);
}
