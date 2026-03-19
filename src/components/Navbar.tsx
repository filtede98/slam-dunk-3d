// Icons removed — nav links removed for scroll-discovery UX
import { useState, useEffect, useRef } from 'react';

interface NavbarProps {
  cartIconRef: React.RefObject<HTMLDivElement>;
}

export default function Navbar({ cartIconRef }: NavbarProps) {
  const [scrolled, setScrolled] = useState(false);
  const [cartCount, setCartCount] = useState(0);
  const [cartBounce, setCartBounce] = useState(false);
  // menuOpen state removed — no nav menu
  const lastScrollY = useRef(0);
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      const currentY = window.scrollY;
      setScrolled(currentY > 50);

      // Hide on scroll down, show on scroll up
      if (currentY > lastScrollY.current && currentY > 300) {
        setHidden(true);
      } else {
        setHidden(false);
      }
      lastScrollY.current = currentY;
    };

    const handleAddToCart = () => {
      setCartCount((prev) => prev + 1);
      setCartBounce(true);
      // Force navbar visible so the hoop is on screen
      setHidden(false);
      setTimeout(() => setCartBounce(false), 600);
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    window.addEventListener('add-to-cart', handleAddToCart);

    return () => {
      window.removeEventListener('scroll', handleScroll);
      window.removeEventListener('add-to-cart', handleAddToCart);
    };
  }, []);

  return (
    <nav
      className={`fixed top-0 left-0 w-full z-50 transition-all duration-500 ${
        hidden ? '-translate-y-full' : 'translate-y-0'
      } ${
        scrolled
          ? 'bg-black/88 backdrop-blur-none md:bg-black/80 md:backdrop-blur-xl py-4 border-b border-white/[0.06]'
          : 'bg-transparent py-6 md:py-8'
      }`}
    >
      <div className="max-w-7xl mx-auto px-6 md:px-12 flex justify-between items-center">
        {/* Logo */}
        <a href="#" className="text-xl md:text-2xl font-display tracking-tight text-accent hover:opacity-80 transition-opacity">
          SLAM DUNK
        </a>

        {/* Spacer to keep layout balanced */}
        <div className="hidden md:block" />

        {/* Cart + Mobile Menu */}
        <div className="flex items-center gap-4">
          <div ref={cartIconRef as React.RefObject<HTMLDivElement>}>
            <button
              className={`relative p-2.5 rounded-full transition-all duration-300 hover:bg-white/5 ${
                cartBounce ? 'scale-125' : 'scale-100'
              }`}
            >
              {/* Basketball hoop icon */}
              <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                {/* Backboard */}
                <rect x="4" y="2" width="16" height="10" rx="1" />
                {/* Rim */}
                <ellipse cx="12" cy="14" rx="5" ry="1.5" />
                {/* Net lines */}
                <path d="M7 14 L9 20" />
                <path d="M10 15.4 L10.5 20" />
                <path d="M14 15.4 L13.5 20" />
                <path d="M17 14 L15 20" />
                {/* Net bottom */}
                <path d="M9 20 Q12 22 15 20" />
              </svg>
              {cartCount > 0 && (
                <span
                  className={`absolute -top-0.5 -right-0.5 bg-accent text-[9px] font-bold w-4.5 h-4.5 flex items-center justify-center rounded-full ${
                    cartBounce ? 'animate-ping-once' : ''
                  }`}
                >
                  {cartCount}
                </span>
              )}
            </button>
          </div>

        </div>
      </div>
    </nav>
  );
}
