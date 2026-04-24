/**
 * Hexagon brand logo – Displays the branding image from /logo.png.
 */
const Logo = ({ size = 40, className = '' }) => (
  <img 
    src="/logo.png" 
    alt="Kagzso Logo" 
    className={`object-contain ${className}`}
    style={{ 
      width: size, 
      height: 'auto',
      maxWidth: '100%'
    }} 
  />
);

export default Logo;
