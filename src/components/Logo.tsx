import React from 'react';

interface LogoProps {
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
  textClassName?: string;
}

export const Logo: React.FC<LogoProps> = ({
  size = 'md',
  className = '',
  textClassName = '',
}) => {
  const sizeMap = {
    xs: 'text-sm sm:text-base tracking-tight',
    sm: 'text-base sm:text-lg tracking-tight',
    md: 'text-lg sm:text-xl md:text-2xl tracking-tight',
    lg: 'text-2xl sm:text-3xl tracking-tight',
    xl: 'text-3xl sm:text-4xl md:text-5xl tracking-tight',
  };

  const selectedSize = sizeMap[size] || sizeMap.md;

  return (
    <div
      className={`inline-flex items-center select-none bg-transparent ${className}`}
      aria-label="shortee.xyz"
    >
      <div className={`flex items-baseline font-black leading-none transition-transform duration-200 group-hover:scale-[1.02] ${textClassName || selectedSize}`}>
        {/* "shortee" adapts smoothly between Light & Dark themes */}
        <span className="text-slate-900 dark:text-white font-extrabold tracking-tight transition-colors duration-200">
          shortee
        </span>
        {/* ".xyz" in vibrant cyan-blue-to-purple gradient with transparent background */}
        <span className="bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 dark:from-cyan-400 dark:via-blue-400 dark:to-purple-400 bg-clip-text text-transparent font-black ml-0.5">
          .xyz
        </span>
      </div>
    </div>
  );
};

export default Logo;
