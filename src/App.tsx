import { TopBar } from "./components/TopBar";
import { Viewport } from "./components/Viewport";
import { Inspector } from "./components/Inspector";
import { MapList } from "./components/MapList";
import { MapPreview } from "./components/MapPreview";

export default function App() {
  return (
    <div className="flex h-full w-full flex-col">
      <TopBar />
      <main className="flex flex-1 min-h-0">
        <MapList />
        <section className="relative flex flex-1 min-w-0">
          <Viewport />
          <MapPreview />
        </section>
        <Inspector />
      </main>
    </div>
  );
}
