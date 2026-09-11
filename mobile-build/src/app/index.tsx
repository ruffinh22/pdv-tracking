import React from 'react';
import { Redirect } from 'expo-router';
import { useApp } from '@/context/AppContext';

export default function Index() {
  const { isOnboarded } = useApp();
  return <Redirect href={isOnboarded ? '/(tabs)' : '/onboarding'} />;
}
