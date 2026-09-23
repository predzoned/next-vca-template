import { Card, CardContent, CardHeader, CardTitle } from "@/kernel/ui/card";
import type { UserDto } from "../contracts/user-dto";

type UserListProps = {
  users: UserDto[];
};

export function UserList({ users }: UserListProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Users</CardTitle>
      </CardHeader>
      <CardContent>
        {users.length === 0 ? (
          <p className="text-muted-foreground text-sm">No users yet.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {users.map((user) => (
              <li key={user.id} className="flex justify-between gap-4 text-sm">
                <span>{user.name}</span>
                <span className="text-muted-foreground">{user.email}</span>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
