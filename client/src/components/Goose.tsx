import React from 'react';
import gussReady from '../assets/guss_ready.png';
import gussStop from '../assets/guss_stop.png';
import gussTapped from '../assets/guss_tapped.png';

type GooseState = 'ready' | 'stop' | 'tapped';

interface GooseProps {
  state: GooseState;
  className?: string;
  onClick?: () => void;
  onMouseDown?: () => void;
  onMouseUp?: () => void;
  onMouseLeave?: () => void;
}

const IMAGES: Record<GooseState, string> = {
  ready: gussReady,
  stop: gussStop,
  tapped: gussTapped,
};

export const Goose: React.FC<GooseProps> = ({
  state,
  className = '',
  onClick,
  onMouseDown,
  onMouseUp,
  onMouseLeave,
}) => {
  return (
    <img
      src={IMAGES[state]}
      alt="Гусь"
      className={className}
      onClick={onClick}
      onMouseDown={onMouseDown}
      onMouseUp={onMouseUp}
      onMouseLeave={onMouseLeave}
      draggable={false}
    />
  );
};
