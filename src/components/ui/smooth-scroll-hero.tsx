import * as React from "react";

import {
	motion,
	useMotionTemplate,
	useReducedMotion,
	useScroll,
	useTransform,
} from "framer-motion";

interface iISmoothScrollHeroProps {
	/**
	 * Height of the scroll section in pixels
	 * @default 1500
	 */
	scrollHeight: number;
	/**
	 * Video source played behind the hero.
	 */
	videoSrc: string;
	/**
	 * Still shown before the video paints, and in place of it when the
	 * visitor prefers reduced motion.
	 */
	posterSrc: string;
	/**
	 * Initial clip path percentage
	 * @default 25
	 */
	initialClipPercentage: number;
	/**
	 * Final clip path percentage
	 * @default 75
	 */
	finalClipPercentage: number;
}

const SmoothScrollHeroBackground: React.FC<iISmoothScrollHeroProps> = ({
	scrollHeight,
	videoSrc,
	posterSrc,
	initialClipPercentage,
	finalClipPercentage,
}) => {
	const {scrollY} = useScroll();
	const reduceMotion = useReducedMotion();

	const clipStart = useTransform(
		scrollY,
		[0, scrollHeight],
		[initialClipPercentage, 0],
	);
	const clipEnd = useTransform(
		scrollY,
		[0, scrollHeight],
		[finalClipPercentage, 100],
	);

	const clipPath = useMotionTemplate`polygon(${clipStart}% ${clipStart}%, ${clipEnd}% ${clipStart}%, ${clipEnd}% ${clipEnd}%, ${clipStart}% ${clipEnd}%)`;

	// The original used background-size 170% -> 100%; a video scales with a
	// transform instead, which is also cheaper to animate.
	const scale = useTransform(scrollY, [0, scrollHeight + 500], [1.7, 1]);

	return (
		<motion.div
			className="sticky top-0 h-screen w-full overflow-hidden bg-black"
			style={{
				clipPath,
				willChange: "clip-path",
			}}
		>
			<motion.div
				className="absolute inset-0"
				style={reduceMotion ? undefined : {scale}}
			>
				{reduceMotion ? (
					<img
						src={posterSrc}
						alt=""
						aria-hidden="true"
						className="h-full w-full object-cover"
					/>
				) : (
					<video
						className="h-full w-full object-cover"
						src={videoSrc}
						poster={posterSrc}
						autoPlay
						muted
						loop
						playsInline
						preload="metadata"
						aria-hidden="true"
						tabIndex={-1}
					/>
				)}
			</motion.div>
		</motion.div>
	);
};

/**
 * A smooth scroll hero component with a parallax video background.
 */
const SmoothScrollHero: React.FC<iISmoothScrollHeroProps> = ({
	scrollHeight = 1500,
	videoSrc,
	posterSrc,
	initialClipPercentage = 25,
	finalClipPercentage = 75,
}) => {
	return (
		<div
			style={{height: `calc(${scrollHeight}px + 100vh)`}}
			className="relative w-full"
		>
			<SmoothScrollHeroBackground
				scrollHeight={scrollHeight}
				videoSrc={videoSrc}
				posterSrc={posterSrc}
				initialClipPercentage={initialClipPercentage}
				finalClipPercentage={finalClipPercentage}
			/>
		</div>
	);
};
export default SmoothScrollHero;
