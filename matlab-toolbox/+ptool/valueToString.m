function s = valueToString(value)
    %VALUETOSTRING Serialise a MATLAB value into the parameter's defaultValue string.
    if isnumeric(value)
        if isscalar(value)
            s = num2str(value);
        else
            s = char(jsonencode(value));
        end
    elseif islogical(value)
        if value
            s = 'true';
        else
            s = 'false';
        end
    elseif ischar(value) || isstring(value)
        s = char(string(value));
    elseif isstruct(value)
        s = char(jsonencode(value));
    else
        s = char(jsonencode(value));
    end
end
