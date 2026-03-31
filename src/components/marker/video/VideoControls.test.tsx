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
    currentTime: 0,
    duration: 0,
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    ...overrides,
  } as unknown as HTMLVideoElement;
  return { current: video } as React.RefObject<HTMLVideoElement | null>;
}

describe("VideoControls", () => {
  beforeEach(() => {
    localStorage.clear();
  });

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

  it("displays formatted duration in time display", () => {
    render(
      <Provider store={makeStore()}>
        <VideoControls videoRef={makeVideoRef()} />
      </Provider>
    );
    // Time display initialises to 00:00 / 04:12 (duration from Redux, currentTime from video events)
    expect(screen.getByText("00:00 / 04:12")).toBeInTheDocument();
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

  it("renders seek bar with duration as max", () => {
    render(
      <Provider store={makeStore()}>
        <VideoControls videoRef={makeVideoRef()} />
      </Provider>
    );
    const seekBar = screen.getByRole("slider", { name: /seek/i });
    expect(seekBar).toHaveAttribute("max", "252");
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
