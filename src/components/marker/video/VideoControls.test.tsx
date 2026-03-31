import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { Provider } from "react-redux";
import { configureStore } from "@reduxjs/toolkit";
import { VideoControls } from "./VideoControls";
import markerReducer from "@/store/slices/markerSlice";
import configReducer from "@/store/slices/configSlice";

function makeStore() {
  const store = configureStore({
    reducer: { marker: markerReducer, config: configReducer },
  });
  // Set up default video state for tests
  store.dispatch({ type: "marker/setCurrentVideoTime", payload: 65 });
  store.dispatch({ type: "marker/setVideoDuration", payload: 252 });
  return store;
}

function makeVideoRef(overrides: Partial<HTMLVideoElement> = {}) {
  const video = {
    volume: 0.8,
    muted: false,
    ...overrides,
  } as HTMLVideoElement;
  return { current: video } as React.RefObject<HTMLVideoElement | null>;
}

describe("VideoControls", () => {
  it("renders play button when paused", () => {
    render(
      <Provider store={makeStore()}>
        <VideoControls videoRef={makeVideoRef()} />
      </Provider>
    );
    expect(screen.getByRole("button", { name: /play/i })).toBeInTheDocument();
  });

  it("renders pause button when playing", () => {
    const store = makeStore();
    store.dispatch({ type: "marker/setVideoPlaying", payload: true });
    render(
      <Provider store={store}>
        <VideoControls videoRef={makeVideoRef()} />
      </Provider>
    );
    expect(screen.getByRole("button", { name: /pause/i })).toBeInTheDocument();
  });

  it("displays formatted current time and duration", () => {
    render(
      <Provider store={makeStore()}>
        <VideoControls videoRef={makeVideoRef()} />
      </Provider>
    );
    // 65s = 01:05, 252s = 04:12 (formatSeconds zero-pads minutes)
    expect(screen.getByText("01:05 / 04:12")).toBeInTheDocument();
  });

  it("dispatches togglePlayPause on play button click", () => {
    const store = makeStore();
    const dispatch = jest.spyOn(store, "dispatch");
    render(
      <Provider store={store}>
        <VideoControls videoRef={makeVideoRef()} />
      </Provider>
    );
    fireEvent.click(screen.getByRole("button", { name: /play/i }));
    expect(dispatch).toHaveBeenCalledWith(
      expect.objectContaining({ type: "marker/togglePlayPause" })
    );
  });

  it("renders seek bar with correct value", () => {
    render(
      <Provider store={makeStore()}>
        <VideoControls videoRef={makeVideoRef()} />
      </Provider>
    );
    const seekBar = screen.getByRole("slider", { name: /seek/i });
    expect(seekBar).toHaveValue("65");
  });

  it("renders volume slider with value from videoRef", () => {
    render(
      <Provider store={makeStore()}>
        <VideoControls videoRef={makeVideoRef({ volume: 0.8 } as HTMLVideoElement)} />
      </Provider>
    );
    const volumeSlider = screen.getByRole("slider", { name: /volume/i });
    expect(volumeSlider).toHaveValue("0.8");
  });
});
