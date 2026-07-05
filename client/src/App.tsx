import { Switch, Route, Router } from "wouter";
import { useHashLocation } from "wouter/use-hash-location";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Analytics } from "@vercel/analytics/react";
import NotFound from "@/pages/not-found";
import Home from "@/pages/Home";
import Builder from "@/pages/Builder";
import ViewSheet from "@/pages/ViewSheet";

function AppRouter() {
  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route path="/build" component={Builder} />
      <Route path="/build/:template" component={Builder} />
      <Route path="/s/:id" component={ViewSheet} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Router hook={useHashLocation}>
          <AppRouter />
        </Router>
        <Analytics />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
