import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface ExchangeRate {
  rate: number;
  fetchedAt: Date | null;
  isLoading: boolean;
  error: string | null;
}

export const useExchangeRate = (): ExchangeRate => {
  const [rate, setRate] = useState<number>(20); // Default fallback rate
  const [fetchedAt, setFetchedAt] = useState<Date | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchLatestRate = async () => {
      try {
        const { data, error: fetchError } = await supabase
          .from('exchange_rates')
          .select('rate, fetched_at')
          .eq('base_currency', 'USD')
          .eq('target_currency', 'MXN')
          .order('fetched_at', { ascending: false })
          .limit(1)
          .single();

        if (fetchError) {
          // No rate found, try to fetch one
          console.log('No exchange rate found, triggering fetch...');
          await supabase.functions.invoke('fetch-exchange-rate');
          
          // Try fetching again after trigger
          const { data: retryData, error: retryError } = await supabase
            .from('exchange_rates')
            .select('rate, fetched_at')
            .eq('base_currency', 'USD')
            .eq('target_currency', 'MXN')
            .order('fetched_at', { ascending: false })
            .limit(1)
            .single();

          if (retryError) {
            throw retryError;
          }

          if (retryData) {
            setRate(Number(retryData.rate));
            setFetchedAt(new Date(retryData.fetched_at));
          }
        } else if (data) {
          setRate(Number(data.rate));
          setFetchedAt(new Date(data.fetched_at));
        }
      } catch (err) {
        console.error('Error fetching exchange rate:', err);
        setError('Failed to fetch exchange rate');
        // Keep default rate of 20
      } finally {
        setIsLoading(false);
      }
    };

    fetchLatestRate();
  }, []);

  return { rate, fetchedAt, isLoading, error };
};

// Utility function to convert USD to MXN
export const convertToMXN = (usdAmount: number, rate: number): number => {
  return usdAmount * rate;
};

// Format MXN currency
export const formatMXN = (amount: number): string => {
  return new Intl.NumberFormat('es-MX', {
    style: 'currency',
    currency: 'MXN',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount) + ' MXN';
};
