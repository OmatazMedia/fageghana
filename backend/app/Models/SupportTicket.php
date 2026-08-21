<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class SupportTicket extends Model
{
    protected $table = 'support_tickets';
    protected $keyType = 'string';
    public $incrementing = false;
    protected $fillable = ['user_id', 'subject', 'description', 'status', 'priority', 'category', 'assigned_to', 'resolved_at', 'created_at'];


    protected static function boot()
    {
        parent::boot();
        static::creating(function ($model) {
            if (empty($model->id)) {
                $model->id = \Illuminate\Support\Str::uuid()->toString();
            }
        });
    }
}
