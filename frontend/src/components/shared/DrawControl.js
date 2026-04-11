// Wrapper for react-leaflet-draw EditControl
// If react-leaflet-draw v4 is not available, this uses a manual draw implementation

import React, { useEffect, useRef } from 'react';
import { useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet-draw';

export function EditControl({ position, onCreated, draw, edit }) {
  const map = useMap();
  const drawnItems = useRef(new L.FeatureGroup());
  const drawControl = useRef(null);

  useEffect(() => {
    if (!map) return;

    map.addLayer(drawnItems.current);

    drawControl.current = new L.Control.Draw({
      position: position || 'topright',
      edit: {
        featureGroup: drawnItems.current,
        edit: edit?.edit !== false,
        remove: edit?.remove !== false,
      },
      draw: {
        polygon: draw?.polygon !== false ? {} : false,
        rectangle: draw?.rectangle || false,
        circle: draw?.circle || false,
        circlemarker: draw?.circlemarker || false,
        marker: draw?.marker || false,
        polyline: draw?.polyline || false,
      },
    });

    map.addControl(drawControl.current);

    const handleCreated = (e) => {
      drawnItems.current.addLayer(e.layer);
      if (onCreated) onCreated(e);
    };

    map.on(L.Draw.Event.CREATED, handleCreated);

    return () => {
      map.off(L.Draw.Event.CREATED, handleCreated);
      if (drawControl.current) map.removeControl(drawControl.current);
      map.removeLayer(drawnItems.current);
    };
  }, [map]);

  return null;
}
