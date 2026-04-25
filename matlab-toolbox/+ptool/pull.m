function ws = pull(client, opts)
    %PULL Fetch the parameter set from the server into a workspace struct.
    %
    %   ws = ptool.pull(client)
    %   ws = ptool.pull(client, AssignToCaller=true)
    %       Also injects each parameter as a variable in the caller.
    arguments
        client (1,1) ptool.ParameterToolClient
        opts.AssignToCaller (1,1) logical = false
    end
    ws = client.pull();
    if opts.AssignToCaller
        names = fieldnames(ws);
        for k = 1:numel(names)
            assignin('caller', names{k}, ws.(names{k}));
        end
    end
end
