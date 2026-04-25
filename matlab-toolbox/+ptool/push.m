function n = push(client, varargin)
    %PUSH Convenience wrapper around ParameterToolClient.push.
    %
    %   n = ptool.push(client)
    %       Pushes every numeric / string / struct variable in the
    %       caller's workspace as a new parameter.
    %   n = ptool.push(client, struct('a', 1, 'b', 2))
    %       Pushes the supplied struct.
    arguments
        client (1,1) ptool.ParameterToolClient
    end
    arguments (Repeating)
        varargin
    end

    if isempty(varargin)
        names = evalin('caller', 'who');
        ws = struct();
        for k = 1:numel(names)
            v = evalin('caller', names{k});
            if isnumeric(v) || islogical(v) || isstruct(v) || isstring(v) || ischar(v)
                ws.(names{k}) = v;
            end
        end
    else
        ws = varargin{1};
    end
    n = client.push(ws);
end
