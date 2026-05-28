'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import dynamic from 'next/dynamic';

import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { BrandMark } from '@/components/brand/brand-mark';
import { GoogleIcon } from '@/components/icons/google';
import { AppleIcon } from '@/components/icons/apple';

const FloatingLines = dynamic(() => import('@/components/animation/FloatingLines'), { ssr: false });

export default function SignupPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleOAuthSignup = async (provider: 'google' | 'apple') => {
    setError('');
    setLoading(true);

    try {
      const supabase = createClient();
      const { error } = await supabase.auth.signInWithOAuth({
        provider,
        options: {
          redirectTo: `${window.location.origin}/auth/callback`,
        },
      });

      if (error) {
        setError(error.message);
        setLoading(false);
      }
    } catch {
      setError('An unexpected error occurred');
      setLoading(false);
    }
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    if (password !== confirmPassword) {
      setError('Passwords do not match');
      setLoading(false);
      return;
    }

    if (password.length < 6) {
      setError('Password must be at least 6 characters');
      setLoading(false);
      return;
    }

    try {
      const supabase = createClient();
      const { error } = await supabase.auth.signUp({
        email,
        password,
      });

      if (error) {
        setError(error.message);
        setLoading(false);
        return;
      }

      setSuccess(true);
      setLoading(false);

      // Redirect to login after 2 seconds
      setTimeout(() => {
        router.push('/login');
      }, 2000);
    } catch (err) {
      setError('An unexpected error occurred');
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="pointer-events-none absolute inset-0 z-0">
        <FloatingLines
          enabledWaves={['top', 'middle', 'bottom']}
          lineCount={8}
          lineDistance={27}
          bendRadius={8}
          bendStrength={-2}
          interactive={false}
          parallax={true}
          animationSpeed={1}
          linesGradient={['#f97316', '#6f6f6f', '#8b5cf6']}
        />
      </div>

      <Card className="relative z-10 w-full max-w-md bg-card/90 shadow-lg shadow-black/10 dark:shadow-black/40">
        <CardHeader className="items-center justify-items-center text-center">
          <BrandMark className="mx-auto h-12" />
          <div className="space-y-1">
            <CardTitle>Sign Up</CardTitle>
            <CardDescription>Create your finance dashboard account</CardDescription>
          </div>
        </CardHeader>
        <form onSubmit={handleSignup} className="space-y-6">
          <CardContent className="space-y-4">
            {error && (
              <div className="rounded-lg border border-red-200/70 bg-red-50 p-3 text-sm text-red-800">
                {error}
              </div>
            )}
            {success && (
              <div className="rounded-lg border border-green-200/70 bg-green-50 p-3 text-sm text-green-800">
                Account created! Check your email for confirmation. Redirecting to login...
              </div>
            )}
            <div className="space-y-2">
              <Button
                type="button"
                variant="outline"
                className="h-10 w-full justify-center shadow-sm transition-shadow hover:shadow-md"
                disabled={loading || success}
                onClick={() => handleOAuthSignup('google')}
              >
                <GoogleIcon className="h-4 w-4" />
                Continue with Google
              </Button>
              
              {/* TODO: re-enable Apple login once we have the necessary credentials set up */}

              {/* <Button
                type="button"
                variant="outline"
                className="h-10 w-full justify-center shadow-sm transition-shadow hover:shadow-md"
                disabled={loading || success}
                onClick={() => handleOAuthSignup('apple')}
              >
                <AppleIcon className="h-4 w-4 text-foreground" />
                Continue with Apple
              </Button> */}

            </div>
            <div className="relative py-1">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-background px-2 text-muted-foreground">Or</span>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                disabled={loading || success}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                disabled={loading || success}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Confirm Password</Label>
              <Input
                id="confirmPassword"
                type="password"
                placeholder="••••••••"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                disabled={loading || success}
              />
            </div>
          </CardContent>
          <CardFooter className="flex flex-col space-y-4">
            <Button type="submit" variant="brand" className="w-full" disabled={loading || success}>
              {loading ? 'Creating account...' : 'Sign Up'}
            </Button>
            <p className="text-center text-sm text-muted-foreground">
              Already have an account?{' '}
              <Link href="/login" className="text-foreground underline-offset-4 hover:underline">
                Sign in
              </Link>
            </p>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}
