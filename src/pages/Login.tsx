import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { toast } from "sonner";
import aiiplLogo from "@/assets/aiipl-logo.png";
import Seo from "@/components/Seo";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const { signIn } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await signIn(email, password);
    setLoading(false);
    if (error) {
      toast.error("Login failed: " + error.message);
    } else {
      navigate("/dashboard");
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Seo title="Admin Login" description="Sign in to AIIPL Truck Parking Terminal to manage heavy-vehicle entries, exits, monthly passes, billing and reports." />
      <h1 className="sr-only">AIIPL Truck Parking Terminal — Admin Login</h1>
      <Card className="w-full max-w-md shadow-lg">
        <CardHeader className="text-center space-y-2">
          <img src={aiiplLogo} alt="AIIPL Truck Parking Terminal logo" className="mx-auto h-20 w-auto" />
          <CardTitle className="text-2xl font-bold">AIIPL Truck Parking Terminal</CardTitle>
          <CardDescription>Sign in to manage your facility</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" value={email} onChange={e => setEmail(e.target.value)} required placeholder="admin@example.com" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input id="password" type="password" value={password} onChange={e => setPassword(e.target.value)} required placeholder="••••••••" minLength={6} />
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Please wait..." : "Login as Admin"}
            </Button>
          </form>
          <p className="mt-4 text-center text-xs text-muted-foreground">
            Accounts are provisioned by the system administrator.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
