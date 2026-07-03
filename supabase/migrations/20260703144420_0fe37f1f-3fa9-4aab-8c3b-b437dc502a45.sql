
CREATE OR REPLACE FUNCTION public.user_open_ticket_from_message(_id UUID, _subject TEXT, _body TEXT, _priority TEXT)
RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER SET search_path='public' AS $$
DECLARE v_ticket UUID;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.message_recipients WHERE message_id=_id AND user_id=auth.uid()) THEN
    RAISE EXCEPTION 'Sem acesso a esta mensagem';
  END IF;
  INSERT INTO public.tickets(user_id,title,description,priority,status,module,type)
  VALUES (auth.uid(),
          COALESCE(NULLIF(btrim(_subject),''),'Chamado a partir de mensagem'),
          COALESCE(_body,''),
          COALESCE(_priority,'medium')::public.ticket_priority,
          'open'::public.ticket_status,
          'account'::public.ticket_module,
          'question'::public.ticket_type)
  RETURNING id INTO v_ticket;
  UPDATE public.messages SET related_ticket_id = v_ticket WHERE id = _id AND related_ticket_id IS NULL;
  INSERT INTO public.comm_audit(actor_id,action,message_id,metadata) VALUES (auth.uid(),'ticket_from_message',_id,jsonb_build_object('ticket_id',v_ticket));
  RETURN v_ticket;
END $$;
