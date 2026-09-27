import Explore from './explore';
import { getChatGPTUser, chatGPTSignInPath } from './chatgpt-auth';
export const dynamic = 'force-dynamic';
export default async function Home() {
  const user = await getChatGPTUser();
  return <Explore user={user ? {name:user.displayName,email:user.email} : null} signInUrl={chatGPTSignInPath('/')} />;
}
