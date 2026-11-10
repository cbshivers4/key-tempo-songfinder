import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";

export function useAdmin() {
  const { user, ready } = useAuth();
  const [isAdmin, setIsAdmin] = useState(false);
  const [checked, setChecked] = useState(false);
  useEffect(() => {
    if (!ready) return;
    if (!user) { setIsAdmin(false); setChecked(true); return; }
    let on = true;
    void supabase.from("user_roles").select("role").eq("user_id", user.id).eq("role", "admin").maybeSingle()
      .then(({ data }) => { if (on) { setIsAdmin(!!data); setChecked(true); } });
    return () => { on = false; };
  }, [user, ready]);
  return { user, ready, isAdmin, checked };
}
