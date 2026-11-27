import React from 'react';
import { formatBengaliDate, formatDateDMY } from '../utils/formatters.ts';

interface DateInputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type' | 'value'> {
  value?: string;
  bengaliDigits?: boolean;
}

export const DateInput: React.FC<DateInputProps> = ({
  value = '',
  className = '',
  bengaliDigits = true,
  onClick,
  ...rest
}) => {
  const display = value
    ? bengaliDigits
      ? formatBengaliDate(value)
      : formatDateDMY(value, false)
    : 'dd-mm-yyyy';

  const handleOpenPicker = (e: React.MouseEvent<HTMLInputElement>) => {
    try {
      (e.currentTarget as HTMLInputElement & { showPicker?: () => void }).showPicker?.();
    } catch {
      // Fallback to native touch/click behavior
    }
    onClick?.(e);
  };

  return (
    <span className={`relative inline-flex items-center cursor-pointer select-none ${className}`}>
      <span className="pointer-events-none whitespace-nowrap tabular-nums leading-tight">
        {display}
      </span>
      <input
        type="date"
        value={value ?? ''}
        onClick={handleOpenPicker}
        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
        aria-label={rest['aria-label'] || 'তারিখ নির্বাচন করুন'}
        {...rest}
      />
    </span>
  );
};
