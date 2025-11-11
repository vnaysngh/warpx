'use client';

import React from 'react';

export type RabbitPose =
  | 'idle'
  | 'hopping'
  | 'victory'
  | 'error'
  | 'thinking'
  | 'sleeping'
  | 'waving'
  | 'excited';

interface RabbitProps {
  pose?: RabbitPose;
  size?: number;
  className?: string;
}

export function Rabbit({ pose = 'idle', size = 120, className = '' }: RabbitProps) {
  const renderRabbit = () => {
    switch (pose) {
      case 'idle':
        return <IdleRabbit />;
      case 'hopping':
        return <HoppingRabbit />;
      case 'victory':
        return <VictoryRabbit />;
      case 'error':
        return <ErrorRabbit />;
      case 'thinking':
        return <ThinkingRabbit />;
      case 'sleeping':
        return <SleepingRabbit />;
      case 'waving':
        return <WavingRabbit />;
      case 'excited':
        return <ExcitedRabbit />;
      default:
        return <IdleRabbit />;
    }
  };

  return (
    <div
      className={className}
      style={{
        width: size,
        height: size,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <svg
        width="100%"
        height="100%"
        viewBox="0 0 200 200"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        {renderRabbit()}
      </svg>
    </div>
  );
}

// Idle Pose - Default standing
function IdleRabbit() {
  return (
    <g className="rabbit-idle">
      {/* Left Ear - Much longer and thinner */}
      <ellipse
        cx="70"
        cy="35"
        rx="10"
        ry="45"
        fill="var(--rabbit-white)"
        stroke="var(--speed-blue)"
        strokeWidth="2.5"
        transform="rotate(-12 70 35)"
      />
      <ellipse
        cx="70"
        cy="35"
        rx="5"
        ry="35"
        fill="var(--neon-pink)"
        opacity="0.4"
        transform="rotate(-12 70 35)"
      />

      {/* Right Ear - Much longer and thinner */}
      <ellipse
        cx="130"
        cy="35"
        rx="10"
        ry="45"
        fill="var(--rabbit-white)"
        stroke="var(--speed-blue)"
        strokeWidth="2.5"
        transform="rotate(12 130 35)"
      />
      <ellipse
        cx="130"
        cy="35"
        rx="5"
        ry="35"
        fill="var(--neon-pink)"
        opacity="0.4"
        transform="rotate(12 130 35)"
      />

      {/* Head */}
      <circle cx="100" cy="95" r="42" fill="var(--rabbit-white)" />
      <circle cx="100" cy="95" r="42" fill="url(#gradient-rabbit)" opacity="0.25" />

      {/* Eyes - larger and more rabbit-like */}
      <ellipse cx="85" cy="88" rx="7" ry="9" fill="var(--bg)" />
      <circle cx="86" cy="86" r="3.5" fill="var(--speed-blue)" />
      <circle cx="87" cy="85" r="1.5" fill="var(--rabbit-white)" opacity="0.9" />
      <ellipse cx="115" cy="88" rx="7" ry="9" fill="var(--bg)" />
      <circle cx="116" cy="86" r="3.5" fill="var(--speed-blue)" />
      <circle cx="117" cy="85" r="1.5" fill="var(--rabbit-white)" opacity="0.9" />

      {/* Nose - triangle shape */}
      <path
        d="M 100 102 L 95 108 L 105 108 Z"
        fill="var(--neon-pink)"
      />

      {/* Buck teeth */}
      <rect x="95" y="108" width="4" height="8" rx="1" fill="var(--rabbit-white)" stroke="var(--bg)" strokeWidth="0.5" />
      <rect x="101" y="108" width="4" height="8" rx="1" fill="var(--rabbit-white)" stroke="var(--bg)" strokeWidth="0.5" />

      {/* Mouth smile lines */}
      <path
        d="M 95 108 Q 90 112 88 110"
        stroke="var(--bg)"
        strokeWidth="1.5"
        fill="none"
        strokeLinecap="round"
      />
      <path
        d="M 105 108 Q 110 112 112 110"
        stroke="var(--bg)"
        strokeWidth="1.5"
        fill="none"
        strokeLinecap="round"
      />

      {/* Whiskers - longer and more prominent */}
      <line x1="50" y1="98" x2="78" y2="96" stroke="var(--fg)" strokeWidth="1.5" opacity="0.6" />
      <line x1="52" y1="103" x2="78" y2="103" stroke="var(--fg)" strokeWidth="1.5" opacity="0.6" />
      <line x1="54" y1="108" x2="78" y2="108" stroke="var(--fg)" strokeWidth="1.5" opacity="0.6" />
      <line x1="122" y1="96" x2="150" y2="98" stroke="var(--fg)" strokeWidth="1.5" opacity="0.6" />
      <line x1="122" y1="103" x2="148" y2="103" stroke="var(--fg)" strokeWidth="1.5" opacity="0.6" />
      <line x1="122" y1="108" x2="146" y2="108" stroke="var(--fg)" strokeWidth="1.5" opacity="0.6" />

      {/* Body */}
      <ellipse cx="100" cy="160" rx="36" ry="38" fill="var(--rabbit-white)" />
      <ellipse cx="100" cy="160" rx="36" ry="38" fill="url(#gradient-rabbit)" opacity="0.15" />

      {/* Chest fluff */}
      <ellipse cx="100" cy="138" rx="20" ry="12" fill="var(--rabbit-white)" opacity="0.8" />

      {/* Arms */}
      <ellipse cx="72" cy="152" rx="9" ry="24" fill="var(--rabbit-white)" />
      <ellipse cx="128" cy="152" rx="9" ry="24" fill="var(--rabbit-white)" />

      {/* Fluffy tail */}
      <circle cx="100" cy="192" r="14" fill="var(--rabbit-white)" opacity="0.9" />
      <circle cx="102" cy="194" r="10" fill="var(--rabbit-white)" />

      {/* Gradient Definitions */}
      <defs>
        <linearGradient id="gradient-rabbit" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="var(--speed-blue)" />
          <stop offset="100%" stopColor="var(--neon-cyan)" />
        </linearGradient>
      </defs>
    </g>
  );
}

// Hopping Pose - For loading states
function HoppingRabbit() {
  return (
    <g className="rabbit-hopping">
      {/* Ears - tilted forward */}
      <ellipse
        cx="65"
        cy="45"
        rx="12"
        ry="35"
        fill="var(--rabbit-white)"
        stroke="var(--speed-blue)"
        strokeWidth="3"
        transform="rotate(-30 65 45)"
      />
      <ellipse
        cx="135"
        cy="45"
        rx="12"
        ry="35"
        fill="var(--rabbit-white)"
        stroke="var(--speed-blue)"
        strokeWidth="3"
        transform="rotate(30 135 45)"
      />

      {/* Head - slightly forward */}
      <circle cx="100" cy="80" r="40" fill="var(--rabbit-white)" />
      <circle cx="100" cy="80" r="40" fill="url(#gradient-speed)" opacity="0.4" />

      {/* Eyes - determined */}
      <ellipse cx="85" cy="75" rx="6" ry="8" fill="var(--bg)" />
      <circle cx="87" cy="74" r="3" fill="var(--speed-blue)" />
      <ellipse cx="115" cy="75" rx="6" ry="8" fill="var(--bg)" />
      <circle cx="117" cy="74" r="3" fill="var(--speed-blue)" />

      {/* Nose */}
      <circle cx="100" cy="90" r="5" fill="var(--neon-pink)" />

      {/* Body - crouched */}
      <ellipse cx="100" cy="140" rx="40" ry="35" fill="var(--rabbit-white)" />

      {/* Arms - stretched back */}
      <ellipse
        cx="60"
        cy="140"
        rx="8"
        ry="20"
        fill="var(--rabbit-white)"
        transform="rotate(-20 60 140)"
      />
      <ellipse
        cx="140"
        cy="140"
        rx="8"
        ry="20"
        fill="var(--rabbit-white)"
        transform="rotate(20 140 140)"
      />

      {/* Speed lines */}
      <line x1="30" y1="120" x2="50" y2="120" stroke="var(--speed-blue)" strokeWidth="3" strokeLinecap="round" opacity="0.6" />
      <line x1="25" y1="135" x2="50" y2="135" stroke="var(--neon-cyan)" strokeWidth="3" strokeLinecap="round" opacity="0.6" />
      <line x1="30" y1="150" x2="55" y2="150" stroke="var(--speed-blue)" strokeWidth="3" strokeLinecap="round" opacity="0.6" />

      <defs>
        <linearGradient id="gradient-speed" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="var(--speed-blue)" />
          <stop offset="100%" stopColor="var(--neon-cyan)" />
        </linearGradient>
      </defs>
    </g>
  );
}

// Victory Pose - For success states
function VictoryRabbit() {
  return (
    <g className="rabbit-victory">
      {/* Ears - perked up excitedly */}
      <ellipse
        cx="70"
        cy="40"
        rx="12"
        ry="38"
        fill="var(--rabbit-white)"
        stroke="var(--neon-cyan)"
        strokeWidth="3"
        transform="rotate(-5 70 40)"
      />
      <ellipse
        cx="130"
        cy="40"
        rx="12"
        ry="38"
        fill="var(--rabbit-white)"
        stroke="var(--neon-cyan)"
        strokeWidth="3"
        transform="rotate(5 130 40)"
      />

      {/* Head */}
      <circle cx="100" cy="90" r="45" fill="var(--rabbit-white)" />
      <circle cx="100" cy="90" r="45" fill="url(#gradient-victory)" opacity="0.3" />

      {/* Eyes - happy closed */}
      <path
        d="M 78 85 Q 85 90 92 85"
        stroke="var(--bg)"
        strokeWidth="3"
        fill="none"
        strokeLinecap="round"
      />
      <path
        d="M 108 85 Q 115 90 122 85"
        stroke="var(--bg)"
        strokeWidth="3"
        fill="none"
        strokeLinecap="round"
      />

      {/* Nose */}
      <circle cx="100" cy="100" r="5" fill="var(--neon-cyan)" />

      {/* Big smile */}
      <path
        d="M 85 105 Q 100 118 115 105"
        stroke="var(--bg)"
        strokeWidth="3"
        fill="none"
        strokeLinecap="round"
      />

      {/* Body */}
      <ellipse cx="100" cy="160" rx="35" ry="40" fill="var(--rabbit-white)" />

      {/* Arms - raised in victory */}
      <ellipse
        cx="65"
        cy="130"
        rx="10"
        ry="30"
        fill="var(--rabbit-white)"
        transform="rotate(-45 65 130)"
      />
      <ellipse
        cx="135"
        cy="130"
        rx="10"
        ry="30"
        fill="var(--rabbit-white)"
        transform="rotate(45 135 130)"
      />

      {/* Confetti */}
      <circle cx="50" cy="60" r="3" fill="var(--neon-pink)" />
      <circle cx="150" cy="70" r="3" fill="var(--carrot-orange)" />
      <circle cx="45" cy="100" r="3" fill="var(--neon-cyan)" />
      <circle cx="155" cy="95" r="3" fill="var(--speed-blue)" />
      <rect x="60" y="50" width="4" height="4" fill="var(--carrot-orange)" transform="rotate(45 62 52)" />
      <rect x="140" y="55" width="4" height="4" fill="var(--neon-pink)" transform="rotate(45 142 57)" />

      <defs>
        <linearGradient id="gradient-victory" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="var(--neon-cyan)" />
          <stop offset="100%" stopColor="var(--speed-blue)" />
        </linearGradient>
      </defs>
    </g>
  );
}

// Error Pose - For error states
function ErrorRabbit() {
  return (
    <g className="rabbit-error">
      {/* Ears - drooping */}
      <ellipse
        cx="75"
        cy="65"
        rx="12"
        ry="35"
        fill="var(--rabbit-white)"
        stroke="var(--error)"
        strokeWidth="3"
        transform="rotate(-40 75 65)"
      />
      <ellipse
        cx="125"
        cy="65"
        rx="12"
        ry="35"
        fill="var(--rabbit-white)"
        stroke="var(--error)"
        strokeWidth="3"
        transform="rotate(40 125 65)"
      />

      {/* Head */}
      <circle cx="100" cy="95" r="45" fill="var(--rabbit-white)" />

      {/* Eyes - dizzy */}
      <g>
        <line x1="78" y1="87" x2="92" y2="97" stroke="var(--bg)" strokeWidth="3" />
        <line x1="78" y1="97" x2="92" y2="87" stroke="var(--bg)" strokeWidth="3" />
      </g>
      <g>
        <line x1="108" y1="87" x2="122" y2="97" stroke="var(--bg)" strokeWidth="3" />
        <line x1="108" y1="97" x2="122" y2="87" stroke="var(--bg)" strokeWidth="3" />
      </g>

      {/* Nose */}
      <circle cx="100" cy="105" r="5" fill="var(--error)" />

      {/* Sad mouth */}
      <path
        d="M 85 115 Q 100 110 115 115"
        stroke="var(--bg)"
        strokeWidth="3"
        fill="none"
        strokeLinecap="round"
      />

      {/* Body - slumped */}
      <ellipse cx="100" cy="165" rx="35" ry="35" fill="var(--rabbit-white)" />

      {/* Arms - down */}
      <ellipse cx="70" cy="165" rx="10" ry="22" fill="var(--rabbit-white)" />
      <ellipse cx="130" cy="165" rx="10" ry="22" fill="var(--rabbit-white)" />

      {/* Stars circling head */}
      <g opacity="0.7">
        <path
          d="M 55 75 L 58 82 L 65 82 L 60 87 L 62 94 L 55 89 L 48 94 L 50 87 L 45 82 L 52 82 Z"
          fill="var(--warning)"
        />
        <path
          d="M 145 75 L 148 82 L 155 82 L 150 87 L 152 94 L 145 89 L 138 94 L 140 87 L 135 82 L 142 82 Z"
          fill="var(--warning)"
        />
      </g>
    </g>
  );
}

// Thinking Pose - For empty states
function ThinkingRabbit() {
  return (
    <g className="rabbit-thinking">
      {/* Ears - one up, one tilted */}
      <ellipse
        cx="70"
        cy="50"
        rx="12"
        ry="35"
        fill="var(--rabbit-white)"
        stroke="var(--speed-blue)"
        strokeWidth="3"
        transform="rotate(-5 70 50)"
      />
      <ellipse
        cx="130"
        cy="55"
        rx="12"
        ry="35"
        fill="var(--rabbit-white)"
        stroke="var(--speed-blue)"
        strokeWidth="3"
        transform="rotate(25 130 55)"
      />

      {/* Head */}
      <circle cx="100" cy="90" r="45" fill="var(--rabbit-white)" />

      {/* Eyes - looking up */}
      <circle cx="85" cy="80" r="8" fill="var(--bg)" />
      <circle cx="87" cy="77" r="3" fill="var(--speed-blue)" />
      <circle cx="115" cy="80" r="8" fill="var(--bg)" />
      <circle cx="117" cy="77" r="3" fill="var(--speed-blue)" />

      {/* Nose */}
      <circle cx="100" cy="100" r="5" fill="var(--neon-pink)" />

      {/* Neutral mouth */}
      <line x1="95" y1="110" x2="105" y2="110" stroke="var(--bg)" strokeWidth="2" />

      {/* Body */}
      <ellipse cx="100" cy="160" rx="35" ry="40" fill="var(--rabbit-white)" />

      {/* Arm - hand on chin */}
      <ellipse
        cx="115"
        cy="115"
        rx="10"
        ry="25"
        fill="var(--rabbit-white)"
        transform="rotate(30 115 115)"
      />
      <circle cx="122" cy="108" r="8" fill="var(--rabbit-white)" />

      {/* Thought bubble */}
      <circle cx="140" cy="50" r="8" fill="var(--bg-panel)" opacity="0.8" />
      <circle cx="150" cy="40" r="12" fill="var(--bg-panel)" opacity="0.8" />
      <circle cx="165" cy="30" r="18" fill="var(--bg-panel)" opacity="0.8" />
      <text x="157" y="37" fontSize="20" fill="var(--fg)">?</text>
    </g>
  );
}

// Sleeping Pose
function SleepingRabbit() {
  return (
    <g className="rabbit-sleeping">
      {/* Ears - flopped down */}
      <ellipse
        cx="70"
        cy="80"
        rx="12"
        ry="35"
        fill="var(--rabbit-white)"
        stroke="var(--fg-muted)"
        strokeWidth="3"
        transform="rotate(-60 70 80)"
      />
      <ellipse
        cx="130"
        cy="80"
        rx="12"
        ry="35"
        fill="var(--rabbit-white)"
        stroke="var(--fg-muted)"
        strokeWidth="3"
        transform="rotate(60 130 80)"
      />

      {/* Head - resting */}
      <ellipse cx="100" cy="100" rx="45" ry="35" fill="var(--rabbit-white)" />

      {/* Eyes - closed */}
      <path
        d="M 78 95 Q 85 98 92 95"
        stroke="var(--bg)"
        strokeWidth="3"
        fill="none"
        strokeLinecap="round"
      />
      <path
        d="M 108 95 Q 115 98 122 95"
        stroke="var(--bg)"
        strokeWidth="3"
        fill="none"
        strokeLinecap="round"
      />

      {/* Nose */}
      <circle cx="100" cy="105" r="4" fill="var(--fg-muted)" />

      {/* Small peaceful smile */}
      <path
        d="M 93 112 Q 100 115 107 112"
        stroke="var(--bg)"
        strokeWidth="2"
        fill="none"
        strokeLinecap="round"
      />

      {/* Body - curled up */}
      <ellipse cx="100" cy="150" rx="50" ry="35" fill="var(--rabbit-white)" />

      {/* ZZZ */}
      <text x="135" y="80" fontSize="16" fill="var(--fg-subtle)" opacity="0.6">Z</text>
      <text x="145" y="70" fontSize="20" fill="var(--fg-subtle)" opacity="0.4">Z</text>
      <text x="155" y="55" fontSize="24" fill="var(--fg-subtle)" opacity="0.2">Z</text>
    </g>
  );
}

// Waving Pose
function WavingRabbit() {
  return (
    <g className="rabbit-waving">
      {/* Ears */}
      <ellipse
        cx="70"
        cy="50"
        rx="12"
        ry="35"
        fill="var(--rabbit-white)"
        stroke="var(--speed-blue)"
        strokeWidth="3"
        transform="rotate(-15 70 50)"
      />
      <ellipse
        cx="130"
        cy="50"
        rx="12"
        ry="35"
        fill="var(--rabbit-white)"
        stroke="var(--speed-blue)"
        strokeWidth="3"
        transform="rotate(15 130 50)"
      />

      {/* Head */}
      <circle cx="100" cy="90" r="45" fill="var(--rabbit-white)" />

      {/* Eyes - friendly */}
      <circle cx="85" cy="85" r="8" fill="var(--bg)" />
      <circle cx="87" cy="83" r="4" fill="var(--speed-blue)" />
      <circle cx="115" cy="85" r="8" fill="var(--bg)" />
      <circle cx="117" cy="83" r="4" fill="var(--speed-blue)" />

      {/* Nose */}
      <circle cx="100" cy="100" r="5" fill="var(--neon-pink)" />

      {/* Happy smile */}
      <path
        d="M 90 108 Q 100 115 110 108"
        stroke="var(--bg)"
        strokeWidth="3"
        fill="none"
        strokeLinecap="round"
      />

      {/* Body */}
      <ellipse cx="100" cy="160" rx="35" ry="40" fill="var(--rabbit-white)" />

      {/* Left arm - normal */}
      <ellipse cx="70" cy="150" rx="10" ry="25" fill="var(--rabbit-white)" />

      {/* Right arm - waving */}
      <ellipse
        cx="145"
        cy="120"
        rx="10"
        ry="28"
        fill="var(--rabbit-white)"
        transform="rotate(-30 145 120)"
      />
      <circle cx="155" cy="105" r="10" fill="var(--rabbit-white)" />

      {/* Wave motion lines */}
      <path
        d="M 165 95 Q 170 90 175 95"
        stroke="var(--speed-blue)"
        strokeWidth="2"
        fill="none"
        opacity="0.5"
      />
      <path
        d="M 165 105 Q 172 100 179 105"
        stroke="var(--neon-cyan)"
        strokeWidth="2"
        fill="none"
        opacity="0.5"
      />
    </g>
  );
}

// Excited Pose
function ExcitedRabbit() {
  return (
    <g className="rabbit-excited">
      {/* Ears - bouncing */}
      <ellipse
        cx="70"
        cy="45"
        rx="12"
        ry="38"
        fill="var(--rabbit-white)"
        stroke="var(--carrot-orange)"
        strokeWidth="3"
        transform="rotate(-10 70 45)"
      />
      <ellipse
        cx="130"
        cy="42"
        rx="12"
        ry="40"
        fill="var(--rabbit-white)"
        stroke="var(--neon-pink)"
        strokeWidth="3"
        transform="rotate(10 130 42)"
      />

      {/* Head */}
      <circle cx="100" cy="90" r="45" fill="var(--rabbit-white)" />
      <circle cx="100" cy="90" r="45" fill="url(#gradient-excited)" opacity="0.3" />

      {/* Eyes - wide open sparkly */}
      <circle cx="85" cy="85" r="10" fill="var(--bg)" />
      <circle cx="87" cy="83" r="4" fill="var(--speed-blue)" />
      <circle cx="89" cy="81" r="2" fill="var(--rabbit-white)" />
      <circle cx="115" cy="85" r="10" fill="var(--bg)" />
      <circle cx="117" cy="83" r="4" fill="var(--speed-blue)" />
      <circle cx="119" cy="81" r="2" fill="var(--rabbit-white)" />

      {/* Nose */}
      <circle cx="100" cy="100" r="6" fill="var(--carrot-orange)" />

      {/* Excited open mouth */}
      <ellipse cx="100" cy="112" rx="10" ry="8" fill="var(--bg)" />
      <path
        d="M 90 108 L 110 108"
        stroke="var(--bg)"
        strokeWidth="3"
        strokeLinecap="round"
      />

      {/* Body - bouncy */}
      <ellipse cx="100" cy="155" rx="38" ry="38" fill="var(--rabbit-white)" />

      {/* Arms - energetic */}
      <ellipse
        cx="68"
        cy="145"
        rx="10"
        ry="26"
        fill="var(--rabbit-white)"
        transform="rotate(-25 68 145)"
      />
      <ellipse
        cx="132"
        cy="145"
        rx="10"
        ry="26"
        fill="var(--rabbit-white)"
        transform="rotate(25 132 145)"
      />

      {/* Energy sparkles */}
      <circle cx="50" cy="90" r="4" fill="var(--carrot-orange)" opacity="0.8" />
      <circle cx="150" cy="85" r="4" fill="var(--neon-pink)" opacity="0.8" />
      <circle cx="45" cy="110" r="3" fill="var(--neon-cyan)" opacity="0.8" />
      <circle cx="155" cy="105" r="3" fill="var(--speed-blue)" opacity="0.8" />

      <defs>
        <linearGradient id="gradient-excited" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="var(--carrot-orange)" />
          <stop offset="50%" stopColor="var(--neon-pink)" />
          <stop offset="100%" stopColor="var(--speed-blue)" />
        </linearGradient>
      </defs>
    </g>
  );
}
