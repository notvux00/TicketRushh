import { useQuery } from "@tanstack/react-query";
import eventApi from "../api/eventApi";

export const useEvents = () => {
  return useQuery({
    queryKey: ["events"],
    queryFn: () => eventApi.getAll(),
  });
};
