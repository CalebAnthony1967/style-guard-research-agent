import React from 'react';
import AmbientBackground from '@/components/AmbientBackground';

export default function AuthLayout({ icon: Icon, title, subtitle, footer, children }) {
  return (
    <div className="relative min-h-screen flex items-center justify-center bg-background px-3 sm:px-4 py-6 sm:py-10">
      <AmbientBackground />
      <div className="relative z-10 w-full max-w-md">
        <div className="text-center mb-6 sm:mb-8">
          <div className="inline-flex items-center justify-center w-12 h-12 sm:w-14 sm:h-14 rounded-2xl bg-primary mb-3 shadow-md">
            <Icon className="w-6 h-6 sm:w-7 sm:h-7 text-primary-foreground" aria-hidden="true" />
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">{title}</h1>
          {subtitle && <p className="text-xs sm:text-sm text-muted-foreground mt-1.5">{subtitle}</p>}
        </div>
        <div className="bg-card/90 backdrop-blur-md rounded-2xl shadow-lg shadow-black/5 border border-border/80 p-5 sm:p-8">
          {children}
        </div>
        {footer && <p className="text-center text-xs sm:text-sm text-muted-foreground mt-5 sm:mt-6">{footer}</p>}
      </div>
    </div>
  );
}