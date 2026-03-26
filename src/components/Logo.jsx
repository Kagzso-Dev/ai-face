/**
 * Hexagon logo — blue-to-teal gradient with inner K/arrow shape,
 * matching the provided brand image.
 */
const Logo = ({ size = 40, className = '' }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 100 100"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={className}
  >
    <defs>
      <linearGradient id="logoGrad" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%"   stopColor="#3B82F6" />
        <stop offset="100%" stopColor="#8B5CF6" />
      </linearGradient>
    </defs>
    
    {/* Hexagon Background */}
    <path
      d="M50 5 L89 27.5 V72.5 L50 95 L11 72.5 V27.5 L50 5Z"
      fill="url(#logoGrad)"
      stroke="white"
      strokeWidth="2"
      strokeOpacity="0.2"
    />
    
    {/* Icon Shape (Stylized K/Arrow) */}
    <path
      d="M35 30 V70 M35 50 L65 30 M35 50 L65 70"
      stroke="white"
      strokeWidth="10"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    
    {/* Highlight circle */}
    <circle cx="50" cy="50" r="40" stroke="white" strokeWidth="1" strokeOpacity="0.1" />
  </svg>
);

export default Logo;
