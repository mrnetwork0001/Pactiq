import React from "react";
import { Composition, Still } from "remotion";
import { Film } from "./Film";
import { Poster } from "./Poster";
import { Short, SHORT_FRAMES } from "./Short";
import { T } from "./timing";

export const Root: React.FC = () => (
  <>
    <Composition id="Pactiq" component={Film} durationInFrames={T.totalFrames} fps={T.fps} width={1920} height={1080} />
    <Composition id="Short" component={Short} durationInFrames={SHORT_FRAMES} fps={T.fps} width={1080} height={1920} />
    <Still id="Poster" component={Poster} width={1920} height={1080} />
  </>
);
