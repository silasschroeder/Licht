"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

export default function AuthCheck({ children }) {
  const router = useRouter();
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Check if user is authenticated
    const checkAuth = async () => {
      try {
        const response = await fetch("http://localhost:8080/api/auth/check", {
          credentials: "include", // Important for cookies
        });

        if (!response.ok) {
          throw new Error("Not authenticated");
        }

        setIsAuthenticated(true);
      } catch (error) {
        console.log("Not authenticated, redirecting to login");
        router.push("/login");
      } finally {
        setIsLoading(false);
      }
    };

    checkAuth();
  }, [router]);

  if (isLoading) {
    return <div>Loading...</div>;
  }

  return isAuthenticated ? children : null;
}
