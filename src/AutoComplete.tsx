import React, { useState, useCallback, ChangeEvent, useMemo, useRef } from "react";
import "./index.css";

const ajaxResponse = ["test1", "test2"];

interface AutoCompleteProps {
  options: Array<string>
  onChange: (value: string) => void,
  onSelect: (value: string) => void
}

function useDebounce() {
  let id: NodeJS.Timer;

  return (callback: Function, delay: number) => {
    if (id) { clearTimeout(id) }

    id = setTimeout(() => {
      callback();
    }, delay);
  }
}

const AutoComplete = ({ options, onChange: onChangeCallback, onSelect: onSelectCallback}: AutoCompleteProps) => {
  const [ value, setValue ] = useState<string>('');
  const inputRef = useRef<HTMLInputElement>(null);
  const debounce = useMemo(useDebounce, []);
  
  const onChange = useCallback((e: ChangeEvent) => {
    const value = (e.target as HTMLInputElement).value;

    setValue(value);
    debounce(() => onChangeCallback(value), 1000);
  }, [debounce, onChangeCallback]);

  const onSelect = useCallback((value: string) => {
    setValue(value);

    inputRef.current!.focus();

    onSelectCallback(value);
  }, [onSelectCallback]);

  return (
    <div>
      <input ref={inputRef} value={ value } onChange={onChange} />

      <div>
        {options.map((opt, i) => (
          <div
            key={i}
            onClick={() => { onSelect(opt); }}
          >
            {opt}
          </div>
        ))}
      </div>
    </div>
  );
}

export default function App() {
  const [ options, setOptions ] = useState<Array<string>>([]);

  const request = useCallback((str: string) => {
    if (!str) { return; }

    setOptions( ajaxResponse );
  }, []);

  const onSelect = useCallback((str: string) => {
    console.log('selected', str);
  }, []);

  return (
    <div className="App">
      <AutoComplete options={options} onChange={request} onSelect={onSelect} />
    </div>
  );
}